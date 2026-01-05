const axios = require('axios');
const cheerio = require('cheerio');
const mapping = require('./mapping.json');
const { getTorboxStream } = require('./torbox');

const QAYADAT_BASE = 'https://play.qayadat.org';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
};

async function checkPixeldrainAvailable(url) {
    try {
        const res = await axios.head(url, {
            timeout: 5000,
            validateStatus: () => true
        });
        // Pixeldrain returns 509 when bandwidth exceeded
        if (res.status === 509 || res.status === 429) {
            console.log('Pixeldrain bandwidth exceeded, using TorBox fallback');
            return false;
        }
        return true;
    } catch (e) {
        console.log('Pixeldrain check failed:', e.message);
        return true; // Assume available if check fails
    }
}

async function resolvePixeldrain(url) {
    try {
        const res = await axios.head(url, { maxRedirects: 0, validateStatus: s => s >= 200 && s < 400 });
        if (res.headers.location) {
            return res.headers.location;
        }
        return url;
    } catch (e) {
        console.log(`Failed to resolve Pixeldrain URL ${url}: ${e.message}`);
        return url;
    }
}

async function getStream(type, id) {
    // ID format: tt123456:1:1 (imdb_id:season:episode)
    let [imdbId, season, episode] = id.split(':');
    season = parseInt(season);
    episode = parseInt(episode);

    // 1. Get Series URL from mapping
    let seriesEntry = mapping[imdbId];
    let seriesUrl = null;
    let seasonOffsets = null;

    if (typeof seriesEntry === 'string') {
        seriesUrl = seriesEntry;
    } else if (typeof seriesEntry === 'object') {
        seriesUrl = seriesEntry.url;
        seasonOffsets = seriesEntry.season_offsets;
    }

    if (!seriesUrl) {
        console.log(`No mapping found for ${imdbId}`);
        return [];
    }

    // Handle Absolute Numbering Mapping (e.g. S3 E14 -> Ep 63)
    let targetEpisode = episode;
    if (seasonOffsets && seasonOffsets[season]) {
        targetEpisode = episode + seasonOffsets[season];
        console.log(`Applied offset for Season ${season}: ${episode} -> Episode ${targetEpisode}`);
    }

    // Loop through pages (max 5) to find the episode
    let episodeUrl = null;
    let currentPage = 1;
    const MAX_PAGES = 5;

    while (!episodeUrl && currentPage <= MAX_PAGES) {
        const pageUrl = currentPage === 1 ? seriesUrl : `${seriesUrl}/page/${currentPage}`;
        console.log(`Checking page ${currentPage}: ${pageUrl}`);

        try {
            const pageRes = await axios.get(pageUrl, { headers: HEADERS });
            const $ = cheerio.load(pageRes.data);

            $('a').each((i, el) => {
                const text = $(el).text().toLowerCase();
                const href = $(el).attr('href');

                if (!href || !href.includes('/video/')) return;

                const episodeRegex = new RegExp(`(?:episode|bolum)\\s*0*${targetEpisode}\\b`, 'i');
                const seasonRegex = new RegExp(`(?:season|sezon)\\s*0*${season}\\b`, 'i');

                if (seasonRegex.test(text) && episodeRegex.test(text)) {
                    episodeUrl = href;
                    return false;
                }

                let strictMode = (season > 1 && !seasonOffsets);

                if (episodeRegex.test(text)) {
                    if (!episodeUrl && !strictMode) {
                        episodeUrl = href;
                    }
                }
            });

            if (episodeUrl) break;
            currentPage++;

        } catch (err) {
            console.log(`Page ${currentPage} error: ${err.message}`);
            break;
        }
    }

    if (!episodeUrl) {
        console.log(`Episode link not found for Season ${season} Episode ${episode} (Target: ${targetEpisode})`);
        return [];
    }

    // Fix relative URLs
    if (!episodeUrl.startsWith('http')) {
        episodeUrl = QAYADAT_BASE + episodeUrl;
    }

    console.log(`Fetching episode page: ${episodeUrl}`);
    try {
        const episodePage = await axios.get(episodeUrl, { headers: HEADERS });
        const $ep = cheerio.load(episodePage.data);

        const streams = [];
        const pixeldrainLinks = [];

        // Collect all Pixeldrain links first
        $ep('a[href*="pixeldrain.com"]').each((i, el) => {
            const href = $ep(el).attr('href');
            const text = $ep(el).text().trim();

            const match = href.match(/pixeldrain\.com\/u\/([a-zA-Z0-9]+)/);
            if (match) {
                const fileId = match[1];
                const cleanTitle = text.replace('Download', '').trim();
                const rawUrl = `https://pixeldrain.com/api/file/${fileId}`;
                pixeldrainLinks.push({ fileId, cleanTitle, rawUrl });
            }
        });

        if (pixeldrainLinks.length === 0) {
            console.log("No Pixeldrain links found on page.");
            return [];
        }

        // Check if Pixeldrain is available (first link as sample)
        const pixeldrainAvailable = await checkPixeldrainAvailable(pixeldrainLinks[0].rawUrl);

        for (const link of pixeldrainLinks) {
            if (pixeldrainAvailable) {
                // Use Pixeldrain directly
                const resolvedUrl = await resolvePixeldrain(link.rawUrl);
                streams.push({
                    title: `Qayadat Play\n${link.cleanTitle}`,
                    url: resolvedUrl,
                    behaviorHints: {
                        notWebReady: true,
                        bingeGroup: "qayadat"
                    }
                });
            } else {
                // Fallback to TorBox
                const torboxUrl = await getTorboxStream(link.rawUrl);
                if (torboxUrl) {
                    streams.push({
                        title: `Qayadat Play (TorBox)\n${link.cleanTitle}`,
                        url: torboxUrl,
                        behaviorHints: {
                            notWebReady: true,
                            bingeGroup: "qayadat-torbox"
                        }
                    });
                } else {
                    // TorBox failed, still add Pixeldrain as last resort
                    streams.push({
                        title: `Qayadat Play (Limited)\n${link.cleanTitle}`,
                        url: link.rawUrl,
                        behaviorHints: {
                            notWebReady: true,
                            bingeGroup: "qayadat"
                        }
                    });
                }
            }
        }

        return streams;

    } catch (e) {
        console.error('Scraping error:', e.message);
        return [];
    }
}

module.exports = { getStream };

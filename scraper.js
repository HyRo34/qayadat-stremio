const axios = require('axios');
const cheerio = require('cheerio');
const mapping = require('./mapping.json');
const { getTorboxStream } = require('./torbox');

const QAYADAT_BASE = 'https://play.qayadat.org';
const QAYADAT_FALLBACK = 'https://qayadatplay.com';

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
        if (res.status === 509 || res.status === 429) {
            console.log('Pixeldrain bandwidth exceeded, using TorBox fallback');
            return false;
        }
        return true;
    } catch (e) {
        console.log('Pixeldrain check failed:', e.message);
        return true;
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

function extractPixeldrainLinks($) {
    const links = [];
    $('a[href*="pixeldrain.com"]').each((i, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().trim();

        const match = href.match(/pixeldrain\.com\/u\/([a-zA-Z0-9]+)/);
        if (match) {
            const fileId = match[1];
            const cleanTitle = text.replace('Download', '').trim();
            const rawUrl = `https://pixeldrain.com/api/file/${fileId}`;
            links.push({ fileId, cleanTitle, rawUrl });
        }
    });
    return links;
}

// Get the show slug from the mapping URL
function getShowSlug(seriesUrl) {
    const parts = seriesUrl.replace(QAYADAT_BASE, '').split('/').filter(p => p);
    let slug = parts[parts.length - 1];
    slug = slug.replace('-urdu-subtitles', '');
    return slug;
}

// Build streams from pixeldrain links
async function buildStreams(pixeldrainLinks) {
    if (pixeldrainLinks.length === 0) return [];

    const pixeldrainAvailable = await checkPixeldrainAvailable(pixeldrainLinks[0].rawUrl);
    const streams = [];

    for (const link of pixeldrainLinks) {
        if (pixeldrainAvailable) {
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
}

async function getStream(type, id) {
    let [imdbId, season, episode] = id.split(':');
    season = parseInt(season);
    episode = parseInt(episode);

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

    let targetEpisode = episode;
    if (seasonOffsets && seasonOffsets[season]) {
        targetEpisode = episode + seasonOffsets[season];
        console.log(`Applied offset for Season ${season}: ${episode} -> Episode ${targetEpisode}`);
    }

    const showSlug = getShowSlug(seriesUrl);

    // === STRATEGY 1: Try primary site (play.qayadat.org) ===
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

    // If we found the episode URL on primary site, try to get links from it
    if (episodeUrl) {
        if (!episodeUrl.startsWith('http')) {
            episodeUrl = QAYADAT_BASE + episodeUrl;
        }

        console.log(`Fetching episode page: ${episodeUrl}`);
        try {
            const episodePage = await axios.get(episodeUrl, { headers: HEADERS });
            const $ep = cheerio.load(episodePage.data);
            const pixeldrainLinks = extractPixeldrainLinks($ep);

            if (pixeldrainLinks.length > 0) {
                console.log(`Found ${pixeldrainLinks.length} Pixeldrain links on primary site`);
                return await buildStreams(pixeldrainLinks);
            }
            console.log("No Pixeldrain links on primary episode page");
        } catch (e) {
            console.log(`Primary episode page error: ${e.message}`);
        }
    } else {
        console.log(`Episode ${targetEpisode} not found on primary site series pages`);
    }

    // === STRATEGY 2: Try fallback site (qayadatplay.com) ===
    const fallbackUrl = `${QAYADAT_FALLBACK}/${showSlug}-episode-${targetEpisode}-urdu-subtitles.html`;
    console.log(`Trying fallback site: ${fallbackUrl}`);

    try {
        const fallbackPage = await axios.get(fallbackUrl, { headers: HEADERS });
        const $fallback = cheerio.load(fallbackPage.data);
        const pixeldrainLinks = extractPixeldrainLinks($fallback);

        if (pixeldrainLinks.length > 0) {
            console.log(`Found ${pixeldrainLinks.length} Pixeldrain links on fallback site!`);
            return await buildStreams(pixeldrainLinks);
        }
        console.log("No Pixeldrain links on fallback site either");
    } catch (fallbackErr) {
        console.log(`Fallback site error: ${fallbackErr.message}`);
    }

    console.log("No streams found from any source");
    return [];
}

module.exports = { getStream };

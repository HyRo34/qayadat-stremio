const axios = require('axios');
const cheerio = require('cheerio');
const mapping = require('./mapping.json');

const QAYADAT_BASE = 'https://play.qayadat.org';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
};

async function resolvePixeldrain(url) {
    try {
        // Pixeldrain API /file/ID redirects to the CDN. Stremio handles redirects usually, 
        // but resolving it explicitly can help with "loading forever" issues.
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

                // Priority 1: Match "Season X ... Episode Y" (Best case)
                if (seasonRegex.test(text) && episodeRegex.test(text)) {
                    episodeUrl = href;
                    return false;
                }

                // Priority 2: Match "Episode Y" ONLY
                // Strictness: If querying Season 1, or if using absolute numbering (offset applied), accept "Episode Y".
                // If querying Season > 1 WITHOUT offset, we usually require Season match to avoid finding S1 E14 when looking for S3 E14.
                // BUT if we applied an offset (e.g. looking for Ep 63), we can trust "Episode 63" because S1 doesn't go that high.
                let strictMode = (season > 1 && !seasonOffsets);

                if (episodeRegex.test(text)) {
                    if (!episodeUrl && !strictMode) {
                        episodeUrl = href;
                    } else if (strictMode) {
                        // We found "Episode 14" but we want S3. And no offset was provided.
                        // Ignore S1's Episode 14.
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

        // 3. Extract Download Links (Pixeldrain)
        const streams = [];

        // Use Promise.all to handle async resolution if we want parallelism, 
        // but cheerio loop is sync. We gather promises then await.
        const linkPromises = [];

        $ep('a[href*="pixeldrain.com"]').each((i, el) => {
            const href = $ep(el).attr('href');
            const text = $ep(el).text().trim();

            const match = href.match(/pixeldrain\.com\/u\/([a-zA-Z0-9]+)/);
            if (match) {
                const fileId = match[1];
                const cleanTitle = text.replace('Download', '').trim();
                const rawUrl = `https://pixeldrain.com/api/file/${fileId}`;

                linkPromises.push(resolvePixeldrain(rawUrl).then(resolvedUrl => {
                    return {
                        title: `Qayadat Play\n${cleanTitle}`,
                        url: resolvedUrl
                    };
                }));
            }
        });

        const resolvedStreams = await Promise.all(linkPromises);
        streams.push(...resolvedStreams);

        if (streams.length === 0) {
            console.log("No streams found on page.");
        }

        return streams;

    } catch (e) {
        console.error('Scraping error:', e.message);
        return [];
    }
}

module.exports = { getStream };

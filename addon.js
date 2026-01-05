const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const { getStream } = require('./scraper');

const manifest = {
    id: 'org.qayadat.stremio',
    version: '1.0.0',
    name: 'Qayadat Play',
    description: 'Watch Turkish shows with Urdu/English subtitles from Qayadat Play',
    resources: ['stream'],
    types: ['series'],
    idPrefixes: ['tt'],
    catalogs: []
};

const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async ({ type, id }) => {
    console.log(`Requesting streams for ${type} ${id}`);
    if (type === 'series') {
        const streams = await getStream(type, id);
        return { streams };
    }
    return { streams: [] };
});

const addonInterface = builder.getInterface();

const port = process.env.PORT || 7000;
serveHTTP(addonInterface, { port });
console.log(`Addon running on http://localhost:${port}`);

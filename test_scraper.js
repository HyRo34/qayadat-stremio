const { getStream } = require('./scraper');

async function test() {
    console.log("Testing Mehmed Season 3 Episode 14 (Expect Offset to Ep 63 + Redirect Resolution)...");
    const streams = await getStream('series', 'tt31323988:3:14');
    console.log("Streams found:", streams);
}

test();

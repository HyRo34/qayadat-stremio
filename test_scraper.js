const { getStream } = require('./scraper');
const fs = require('fs');

async function test() {
    const output = [];
    output.push("=== Testing Kurulus Orhan Episode 10 ===");
    output.push("This episode is NOT on primary site series page");
    output.push("It SHOULD find links on qayadatplay.com fallback\n");

    const streams = await getStream('series', 'tt38607251:1:10');

    output.push("\n=== RESULTS ===");
    output.push("Streams found: " + streams.length);

    if (streams.length > 0) {
        streams.forEach((s, i) => {
            output.push(`\nStream ${i + 1}:`);
            output.push("  Title: " + s.title.replace('\n', ' - '));
            output.push("  URL: " + s.url);
        });
    } else {
        output.push("No streams found!");
    }

    fs.writeFileSync('test_output.txt', output.join('\n'));
    console.log("Results written to test_output.txt");
}

test().catch(console.error);

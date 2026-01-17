const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function checkPage() {
    const output = [];
    output.push("Checking series page for Episode 10...\n");

    const res = await axios.get('https://play.qayadat.org/series/kurulus-orhan-urdu-subtitles');
    const $ = cheerio.load(res.data);

    let found = false;
    const episodes = [];

    $('a').each((i, el) => {
        const text = $(el).text().toLowerCase().trim();
        const href = $(el).attr('href') || '';

        if (href.includes('/video/') && text.includes('episode')) {
            episodes.push({ text: text.substring(0, 80), href });

            if (text.includes('episode 10')) {
                found = true;
            }
        }
    });

    if (found) {
        output.push("Episode 10 FOUND on the page!");
    } else {
        output.push("Episode 10 NOT found on page 1!");
    }

    output.push("\nAll episodes found on page:");
    episodes.forEach(ep => {
        output.push("  - " + ep.text);
        output.push("    " + ep.href);
    });

    fs.writeFileSync('debug_output.txt', output.join('\n'));
    console.log("Results written to debug_output.txt");
}

checkPage().catch(console.error);

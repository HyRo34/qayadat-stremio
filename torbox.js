const axios = require('axios');

const TORBOX_API = 'https://api.torbox.app/v1/api';

async function getTorboxStream(pixeldrainUrl) {
    const apiKey = process.env.TORBOX_API_KEY;

    if (!apiKey) {
        console.log('TorBox API key not configured');
        return null;
    }

    try {
        // Step 1: Create a web download request
        const createResponse = await axios.post(
            `${TORBOX_API}/webdl/createwebdownload`,
            { url: pixeldrainUrl },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!createResponse.data.success) {
            console.log('TorBox create failed:', createResponse.data.detail);
            return null;
        }

        const downloadId = createResponse.data.data.webdownload_id;
        console.log(`TorBox download created: ${downloadId}`);

        // Step 2: Wait a moment for processing
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 3: Get the download link
        const linkResponse = await axios.get(
            `${TORBOX_API}/webdl/requestdl?token=${apiKey}&web_id=${downloadId}&zip_link=false`,
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            }
        );

        if (linkResponse.data.success && linkResponse.data.data) {
            console.log('TorBox stream ready');
            return linkResponse.data.data;
        }

        // If not ready, try getting cached version
        const cachedResponse = await axios.get(
            `${TORBOX_API}/webdl/checkcached?url=${encodeURIComponent(pixeldrainUrl)}`,
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            }
        );

        if (cachedResponse.data.success && cachedResponse.data.data) {
            return cachedResponse.data.data;
        }

        return null;

    } catch (error) {
        console.log('TorBox error:', error.message);
        return null;
    }
}

module.exports = { getTorboxStream };

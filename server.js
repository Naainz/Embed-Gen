const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/embed', async (req, res) => {
    const { url } = req.query;

    if (!url || !url.startsWith('https://www.tiktok.com')) {
        return res.status(400).json({ error: 'Invalid TikTok URL' });
    }

    try {
        // Fetch TikTok video metadata by scraping the page
        const videoMetadata = await fetchTikTokMetadata(url);

        // Customize the embed
        const customEmbed = createCustomEmbed(videoMetadata);

        res.json(customEmbed);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch TikTok data' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Function to fetch TikTok video metadata by scraping the page
async function fetchTikTokMetadata(url) {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);

    // Extracting the necessary data
    const title = $('title').text();
    const description = $('meta[name="description"]').attr('content');
    const likes = parseLikes($('[data-e2e="like-count"]').text());
    const comments = parseLikes($('[data-e2e="comment-count"]').text());
    const videoUrl = $('meta[property="og:video"]').attr('content');
    const thumbnailUrl = $('meta[property="og:image"]').attr('content');

    return {
        title,
        description,
        likes,
        comments,
        videoUrl,
        thumbnailUrl,
    };
}

// Helper function to parse likes/comments
function parseLikes(likeString) {
    if (likeString.includes('K')) {
        return parseFloat(likeString) * 1000;
    } else if (likeString.includes('M')) {
        return parseFloat(likeString) * 1000000;
    } else {
        return parseFloat(likeString);
    }
}

// Function to create a custom embed
function createCustomEmbed(metadata) {
    return {
        "embeds": [
            {
                "type": "video",
                "url": metadata.videoUrl,
                "title": metadata.description,
                "description": `${metadata.likes} likes, ${metadata.comments} comments`,
                "color": 16657493,
                "provider": {
                    "name": "Naainz Embed.Gen - TikTok"
                },
                "video": {
                    "url": metadata.videoUrl,
                    "width": 1080,  // Adjust based on actual video dimensions
                    "height": 1920  // Adjust based on actual video dimensions
                },
                "thumbnail": {
                    "url": metadata.thumbnailUrl,
                    "proxy_url": metadata.thumbnailUrl,
                    "width": 630,
                    "height": 630
                }
            }
        ]
    };
}

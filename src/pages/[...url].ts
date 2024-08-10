import type { APIRoute } from 'astro';
import axios from 'axios';
import * as cheerio from 'cheerio';

export const get: APIRoute = async ({ params, request }) => {
  const baseUrl = 'http://localhost:4322/';
  const tiktokUrl = decodeURIComponent(request.url.replace(baseUrl, ''));

  console.log("Received TikTok URL:", tiktokUrl);

  const tiktokUrlPattern = /^https:\/\/(www\.)?tiktok\.com\/.+/;

  if (!tiktokUrl || !tiktokUrlPattern.test(tiktokUrl)) {
    return new Response(JSON.stringify({ error: 'Invalid TikTok URL' }), {
      status: 400,
    });
  }

  try {
    const videoMetadata = await fetchTikTokMetadata(tiktokUrl);
    const customEmbed = createCustomEmbed(videoMetadata);

    return new Response(JSON.stringify(customEmbed), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Failed to fetch TikTok data' }), {
      status: 500,
    });
  }
};

async function fetchTikTokMetadata(url: string) {
  const response = await axios.get(url);
  const html = response.data;
  const $ = cheerio.load(html);

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

function parseLikes(likeString: string) {
  if (likeString.includes('K')) {
    return parseFloat(likeString) * 1000;
  } else if (likeString.includes('M')) {
    return parseFloat(likeString) * 1000000;
  } else {
    return parseFloat(likeString);
  }
}

function createCustomEmbed(metadata: any) {
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
          "width": 1080,
          "height": 1920
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

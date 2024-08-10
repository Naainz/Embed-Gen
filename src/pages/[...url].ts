import type { APIRoute } from 'astro';
import axios from 'axios';
import * as cheerio from 'cheerio';

export const GET: APIRoute = async ({ params, request }) => {
  const baseUrl = 'http://localhost:3003/';
  const tiktokUrl = decodeURIComponent(request.url.replace(baseUrl, ''));

  if (tiktokUrl.endsWith('favicon.ico')) {
    return new Response(null, { status: 204 });
  }

  console.log("TikTok URL being processed:", tiktokUrl);

  const tiktokUrlPattern = /^https:\/\/(www\.)?tiktok\.com\/.+/;

  if (!tiktokUrl || !tiktokUrlPattern.test(tiktokUrl)) {
    console.error("Validation failed for URL:", tiktokUrl);
    return new Response(JSON.stringify({ error: 'Invalid TikTok URL' }), {
      status: 400,
    });
  }

  try {
    const videoMetadata = await fetchTikTokMetadata(tiktokUrl);
    console.log("Fetched TikTok Metadata:", videoMetadata);

    const customEmbed = createCustomEmbed(videoMetadata);
    console.log("Generated Embed:", customEmbed);

    return new Response(JSON.stringify(customEmbed), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Error occurred while fetching TikTok data:", error);
    return new Response(JSON.stringify({ error: 'Failed to fetch TikTok data' }), {
      status: 500,
    });
  }
};

async function fetchTikTokMetadata(url: string) {
  console.log("Fetching TikTok page:", url);

  const response = await axios.get(url);
  const html = response.data;
  const $ = cheerio.load(html);

  // Extract the title, likes, comments, and thumbnail URL
  const title = $('meta[property="og:title"]').attr('content') || "TikTok";
  const description = $('meta[property="og:description"]').attr('content') || "";
  const likes = $('strong[data-e2e="like-count"]').text().trim();
  const comments = $('strong[data-e2e="comment-count"]').text().trim();
  const thumbnailUrl = $('meta[property="og:image"]').attr('content');

  console.log("Title extracted:", title);
  console.log("Description extracted:", description);
  console.log("Likes extracted:", likes);
  console.log("Comments extracted:", comments);
  console.log("Thumbnail URL extracted:", thumbnailUrl);

  return {
    title,
    description,
    likes,   
    comments, 
    videoUrl: url, // Use the original URL as the video URL
    thumbnailUrl,
  };
}

function createCustomEmbed(metadata: any) {
  console.log("Creating embed with metadata:", metadata);

  return {
    "embeds": [
      {
        "type": "article",
        "url": metadata.videoUrl,
        "title": metadata.title,
        "description": `${metadata.likes} likes, ${metadata.comments} comments. ${metadata.description}`,
        "color": 16657493,
        "provider": {
          "name": "Naainz Embed.Gen - TikTok"
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

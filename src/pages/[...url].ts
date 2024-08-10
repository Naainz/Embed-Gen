import type { APIRoute } from 'astro';
import puppeteer from 'puppeteer';

export const GET: APIRoute = async ({ params, request }) => {
  const baseUrl = 'http://localhost:3008/';
  const tiktokUrl = decodeURIComponent(request.url.replace(baseUrl, ''));

  // Ignore requests for favicon.ico
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

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Navigate to the TikTok URL
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Extract necessary metadata
    const username = await page.$eval('meta[property="og:title"]', element => element.getAttribute('content')) || "TikTok";
    const description = await page.$eval('meta[property="og:description"]', element => element.getAttribute('content')) || "";
    const likes = await page.$eval('strong[data-e2e="like-count"]', element => element.textContent.trim());
    const comments = await page.$eval('strong[data-e2e="comment-count"]', element => element.textContent.trim());

    // Extract the video URL from embedded JSON or by inspecting the page's JS context
    const videoUrl = await page.evaluate(() => {
      const data = window.__INIT_PROPS__ || window.__DYNAMIC_PAGE_DATA__;
      return data && data?.props?.pageProps?.itemInfo?.itemStruct?.video?.downloadAddr || null;
    });

    console.log("Username extracted:", username);
    console.log("Description extracted:", description);
    console.log("Likes extracted:", likes);
    console.log("Comments extracted:", comments);
    console.log("Video URL extracted:", videoUrl);

    await browser.close();

    return {
      username,
      description,
      likes,
      comments,
      videoUrl, // This is the actual video URL
    };

  } catch (error) {
    console.error("Error during page evaluation:", error);
    await browser.close();
    throw error;
  }
}

function createCustomEmbed(metadata: any) {
  console.log("Creating embed with metadata:", metadata);

  // Create the title with emojis
  const title = `${metadata.username} ${metadata.likes} 👍, ${metadata.comments} 💬`;

  return {
    "embeds": [
      {
        "type": "article",
        "url": metadata.videoUrl,
        "title": title,
        "description": `${metadata.description}`,
        "color": 16657493,
        "provider": {
          "name": "e.naai.nz - TikTok"
        },
        "video": {
          "url": metadata.videoUrl,
          "width": 1080,
          "height": 1920
        },
        "thumbnail": {
          "url": metadata.videoUrl,
          "proxy_url": metadata.videoUrl,
          "width": 630,
          "height": 630
        }
      }
    ]
  };
}

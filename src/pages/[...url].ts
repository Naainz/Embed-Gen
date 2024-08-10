import type { APIRoute } from 'astro';
import puppeteer from 'puppeteer';

export const GET: APIRoute = async ({ params, request }) => {
  const baseUrl = 'http://localhost:3003/';
  const targetUrl = decodeURIComponent(request.url.replace(baseUrl, ''));

  if (targetUrl.endsWith('favicon.ico')) {
    return new Response(null, { status: 204 });
  }

  const tiktokUrlPattern = /^https:\/\/(www\.)?tiktok\.com\/.+/;
  const youtubeUrlPattern = /^https:\/\/(www\.)?youtube\.com\/watch\?v=.+/;

  if (!targetUrl || (!tiktokUrlPattern.test(targetUrl) && !youtubeUrlPattern.test(targetUrl))) {
    console.error("Validation failed for URL:", targetUrl);
    return new Response(JSON.stringify({ error: 'Invalid TikTok or YouTube URL' }), {
      status: 400,
    });
  }

  try {
    let videoMetadata, customEmbed;

    if (tiktokUrlPattern.test(targetUrl)) {
      console.log("TikTok URL being processed:", targetUrl);
      videoMetadata = await fetchTikTokMetadata(targetUrl);
      console.log("Fetched TikTok Metadata:", videoMetadata);
      customEmbed = createTikTokEmbed(targetUrl, videoMetadata);
    } else if (youtubeUrlPattern.test(targetUrl)) {
      console.log("YouTube URL being processed:", targetUrl);
      videoMetadata = await fetchYouTubeMetadata(targetUrl);
      console.log("Fetched YouTube Metadata:", videoMetadata);
      customEmbed = createYouTubeEmbed(targetUrl, videoMetadata);
    }

    console.log("Generated Embed:", customEmbed);

    return new Response(JSON.stringify(customEmbed), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Error occurred while fetching video data:", error);
    return new Response(JSON.stringify({ error: 'Failed to fetch video data' }), {
      status: 500,
    });
  }
};

async function fetchTikTokMetadata(url: string) {
  console.log("Fetching TikTok page:", url);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2' });

    const username = await page.$eval('meta[property="og:title"]', element => element.getAttribute('content')) || "TikTok";
    const description = await page.$eval('meta[property="og:description"]', element => element.getAttribute('content')) || "";
    const likes = await page.$eval('strong[data-e2e="like-count"]', element => element.textContent.trim());
    const comments = await page.$eval('strong[data-e2e="comment-count"]', element => element.textContent.trim());
    const videoSrc = await page.$eval('video', video => video.getAttribute('src'));

    console.log("Username extracted:", username);
    console.log("Description extracted:", description);
    console.log("Likes extracted:", likes);
    console.log("Comments extracted:", comments);
    console.log("Video URL extracted:", videoSrc);

    await browser.close();

    return {
      username,
      description,
      likes,
      comments,
      videoSrc,
    };

  } catch (error) {
    console.error("Error during page evaluation:", error);
    await browser.close();
    throw error;
  }
}

async function fetchYouTubeMetadata(url: string) {
  console.log("Fetching YouTube page:", url);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2' });

    await page.waitForSelector('h1.title.style-scope.ytd-video-primary-info-renderer');
    const title = await page.$eval('h1.title.style-scope.ytd-video-primary-info-renderer', element => element.textContent.trim()) || "YouTube Video";

    // Correctly targeting the producer's name based on your structure
    const channelName = await page.$eval('div#container.ytd-channel-name a.yt-simple-endpoint.style-scope.yt-formatted-string', element => element.textContent.trim());

    const videoId = new URL(url).searchParams.get('v');
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    console.log("Title extracted:", title);
    console.log("Channel Name extracted:", channelName);
    console.log("Thumbnail URL generated:", thumbnailUrl);

    await browser.close();

    return {
      title,
      channelName,
      thumbnailUrl,
    };

  } catch (error) {
    console.error("Error during page evaluation:", error);
    await browser.close();
    throw error;
  }
}

function createTikTokEmbed(tiktokUrl: string, metadata: any) {
  console.log("Creating TikTok embed with metadata:", metadata);

  const title = `${metadata.username} ${metadata.likes} 👍, ${metadata.comments} 💬`;

  return {
    "embeds": [
      {
        "type": "article",
        "url": tiktokUrl,
        "title": title,
        "description": `${metadata.description}`,
        "color": 16657493,
        "provider": {
          "name": " TikTok "
        },
        "video": {
          "url": metadata.videoSrc,
          "width": 1080,
          "height": 1920
        },
        "thumbnail": {
          "url": metadata.videoSrc,
          "proxy_url": metadata.videoSrc,
          "width": 630,
          "height": 630
        }
      }
    ]
  };
}

function createYouTubeEmbed(youtubeUrl: string, metadata: any) {
  console.log("Creating YouTube embed with metadata:", metadata);

  const title = `${metadata.title} by ${metadata.channelName}`;

  return {
    "embeds": [
      {
        "type": "article",
        "url": youtubeUrl,
        "title": title,
        "description": `${metadata.channelName}`,
        "color": 16657493,
        "provider": {
          "name": " YouTube "
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

import type { APIRoute } from 'astro';
import axios from 'axios';
import * as cheerio from 'cheerio';
import FormData from 'form-data';

class Resource {
  url: string;
  index: number;

  constructor(url: string, index: number) {
    this.index = index;
    this.url = url;
  }

  download(config = {}) {
    return axios({
      url: this.url,
      responseType: 'stream',
      ...config,
    });
  }
}

class SnapTikClient {
  axiosInstance = axios.create({
    baseURL: 'https://dev.snaptik.app',
  });

  async get_token(): Promise<string> {
    const { data } = await this.axiosInstance.get('/');
    const $ = cheerio.load(data);
    const token = $('input[name="token"]').val();
    if (typeof token !== 'string') {
      throw new Error('Failed to retrieve token');
    }
    return token;
  }

  async get_script(url: string): Promise<string> {
    const form = new FormData();
    const token = await this.get_token();

    form.append('token', token);
    form.append('url', url);

    const { data } = await this.axiosInstance.post('/abc2.php', form, {
      headers: form.getHeaders(),
    });

    return data;
  }
  async eval_script(script1: string): Promise<{ html: string; oembed_url: string }> {
    // Simulate a basic environment without 'window'
    const fakeDom = {
      document: {
        getElementById: () => ({
          src: '',
        }),
      },
      fetch: (a: string) => {
        return Promise.resolve({
          json: () => ({ thumbnail_url: '' }),
        });
      },
      XMLHttpRequest: function () {
        return {
          open() {},
          send() {},
        };
      },
    };
  
    return new Promise<{ html: string; oembed_url: string }>((resolve, reject) => {
      try {
        let html = '';
  
        // Mock the execution environment
        Function('document', 'fetch', 'XMLHttpRequest', 'eval', script1)(
          fakeDom.document,
          fakeDom.fetch,
          fakeDom.XMLHttpRequest,
          resolve
        );
  
        resolve({ html, oembed_url: '' });
      } catch (error) {
        reject(error);
      }
    });
  }
  
  async get_hd_video(token: string): Promise<string> {
    const { data } = await this.axiosInstance.get(`/getHdLink.php?token=${token}`);

    if (data.error) throw new Error(data.error);
    return data.url;
  }

  async parse_html(html: string, url: string): Promise<
  { type: 'video'; data: { sources: Resource[] }; oembed_url?: string; url: string } |
  { type: 'photo'; data: { sources: Resource[] }; oembed_url?: string; url: string } |
  { type: 'slideshow'; data: { photos: { sources: Resource[] }[] }; oembed_url?: string; url: string }
> {
  if (!html || typeof html !== 'string') {
    throw new Error('Invalid HTML content provided to cheerio.load()');
  }

  console.log('HTML content length:', html.length);

  const $ = cheerio.load(html);
  const is_video = !$('div.render-wrapper').length;

  if (is_video) {
    const hd_token = $('div.video-links > button[data-tokenhd]').data('tokenhd');
    if (typeof hd_token !== 'string') {
      throw new Error('Failed to retrieve HD token');
    }
    const hd_url = new URL(await this.get_hd_video(hd_token));
    const token = hd_url.searchParams.get('token');
    if (!token) {
      throw new Error('Failed to retrieve video token');
    }
    const { url: videoUrl } = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString('ascii')
    );

    return {
      type: 'video',
      data: {
        sources: [
          videoUrl,
          hd_url.href,
          ...$('div.video-links > a:not(a[href="/"])')
            .toArray()
            .map((elem) => $(elem).attr('href'))
            .map((x) => (x.startsWith('/') ? this.axiosInstance.defaults.baseURL + x : x))
            .map((x, index) => new Resource(x, index)),
        ],
      },
      url: videoUrl,
    };
  }

  const photos = $('div.columns > div.column > div.photo')
    .toArray()
    .map((elem) => ({
      sources: [
        $(elem).find('img[alt="Photo"]').attr('src'),
        $(elem).find('a[data-event="download_albumPhoto_photo"]').attr('href'),
      ].map((x, index) => new Resource(x!, index)),
    }));

  return photos.length === 1
    ? { type: 'photo', data: { sources: photos[0].sources }, url }
    : { type: 'slideshow', data: { photos }, url };
}

export const get: APIRoute = async ({ params, request }) => {
  const baseUrl = 'http://localhost:3001/';
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
    const client = new SnapTikClient();
    const html = await fetchTikTokHtml(tiktokUrl);
    const videoMetadata = await client.parse_html(html, tiktokUrl);

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

function createCustomEmbed(
  metadata: {
    type: 'video' | 'photo' | 'slideshow';
    data: { sources?: Resource[]; photos?: { sources: Resource[] }[] };
    oembed_url?: string;
    url: string;
  }
) {
  console.log("Creating embed with metadata:", metadata);

  let videoUrl: string | undefined;

  if (metadata.type === 'video') {
    videoUrl = metadata.data.sources![0].url;
  } else if (metadata.type === 'photo') {
    videoUrl = metadata.data.sources![0].url;
  } else if (metadata.type === 'slideshow' && metadata.data.photos) {
    videoUrl = metadata.data.photos[0].sources[0].url;
  }

  return {
    "embeds": [
      {
        "type": "article",
        "url": metadata.url,
        "title": `${metadata.url} TikTok`,
        "description": `${metadata.type}`,
        "color": 16657493,
        "provider": {
          "name": "e.naai.nz - TikTok"
        },
        "video": {
          "url": videoUrl!,
          "width": 1080,
          "height": 1920
        },
        "thumbnail": {
          "url": videoUrl!,
          "proxy_url": videoUrl!,
          "width": 630,
          "height": 630
        }
      }
    ]
  };
}

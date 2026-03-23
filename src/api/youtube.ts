const YT_API = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
  channelTitle: string;
  url: string;
}

export async function fetchLatestVideos(
  channelId: string,
  apiKey: string,
  maxResults: number = 5,
): Promise<YouTubeVideo[]> {
  try {
    const params = new URLSearchParams({
      part: 'snippet',
      channelId,
      order: 'date',
      maxResults: maxResults.toString(),
      type: 'video',
      key: apiKey,
    });

    const res = await fetch(`${YT_API}/search?${params}`);
    if (!res.ok) return [];

    const data = (await res.json()) as {
      items: {
        id: { videoId: string };
        snippet: {
          title: string;
          description: string;
          publishedAt: string;
          thumbnails: { high: { url: string } };
          channelTitle: string;
        };
      }[];
    };

    return data.items.map((item) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      publishedAt: item.snippet.publishedAt,
      thumbnailUrl: item.snippet.thumbnails.high.url,
      channelTitle: item.snippet.channelTitle,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    }));
  } catch (err) {
    console.error('[YouTube API]', err);
    return [];
  }
}

const TWITCH_API = 'https://api.twitch.tv/helix';

let twitchToken: string | null = null;
let twitchTokenExpires = 0;

export interface TwitchStream {
  id: string;
  user_id: string;
  user_name: string;
  game_name: string;
  title: string;
  viewer_count: number;
  started_at: string;
  thumbnail_url: string;
  is_mature: boolean;
}

async function getTwitchToken(clientId: string, clientSecret: string): Promise<string> {
  if (twitchToken && Date.now() < twitchTokenExpires) return twitchToken;

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  if (!res.ok) throw new Error(`Twitch OAuth failed: ${res.status}`);

  const data = (await res.json()) as { access_token: string; expires_in: number };
  twitchToken = data.access_token;
  twitchTokenExpires = Date.now() + data.expires_in * 1000 - 60_000;
  return twitchToken;
}

export async function checkIfLive(
  channelName: string,
  clientId: string,
  clientSecret: string,
): Promise<TwitchStream | null> {
  try {
    const token = await getTwitchToken(clientId, clientSecret);
    const res = await fetch(
      `${TWITCH_API}/streams?user_login=${encodeURIComponent(channelName)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Client-Id': clientId,
        },
      },
    );

    if (!res.ok) return null;
    const data = (await res.json()) as { data: TwitchStream[] };
    return data.data?.[0] ?? null;
  } catch (err) {
    console.error('[Twitch API]', err);
    return null;
  }
}

export async function fetchUserInfo(
  channelName: string,
  clientId: string,
  clientSecret: string,
): Promise<{ profile_image_url: string; display_name: string } | null> {
  try {
    const token = await getTwitchToken(clientId, clientSecret);
    const res = await fetch(
      `${TWITCH_API}/users?login=${encodeURIComponent(channelName)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Client-Id': clientId,
        },
      },
    );

    if (!res.ok) return null;
    const data = (await res.json()) as { data: { profile_image_url: string; display_name: string }[] };
    return data.data?.[0] ?? null;
  } catch {
    return null;
  }
}

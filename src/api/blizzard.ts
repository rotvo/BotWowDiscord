import { config } from '../config.js';

let accessToken: string | null = null;
let tokenExpires = 0;

const REGION_HOSTS: Record<string, string> = {
  us: 'https://us.api.blizzard.com',
  eu: 'https://eu.api.blizzard.com',
  kr: 'https://kr.api.blizzard.com',
  tw: 'https://tw.api.blizzard.com',
};

async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpires) return accessToken;

  if (!config.blizzard.clientId || !config.blizzard.clientSecret) {
    throw new Error('Blizzard API credentials not configured');
  }

  const auth = Buffer.from(
    `${config.blizzard.clientId}:${config.blizzard.clientSecret}`,
  ).toString('base64');

  const res = await fetch('https://oauth.battle.net/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) throw new Error(`Blizzard OAuth failed: ${res.status}`);

  const data = (await res.json()) as { access_token: string; expires_in: number };
  accessToken = data.access_token;
  tokenExpires = Date.now() + data.expires_in * 1000 - 60_000;
  return accessToken;
}

async function apiGet<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  try {
    const token = await getAccessToken();
    const region = config.guild.region;
    const host = REGION_HOSTS[region] ?? REGION_HOSTS.us;
    const url = new URL(path, host);
    url.searchParams.set('namespace', `profile-${region}`);
    url.searchParams.set('locale', 'es_MX');
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err) {
    console.error('[Blizzard API]', err);
    return null;
  }
}

export interface BlizzardCharacter {
  id: number;
  name: string;
  level: number;
  character_class: { name: string };
  active_spec: { name: string };
  realm: { name: string; slug: string };
  faction: { name: string };
  equipped_item_level: number;
  average_item_level: number;
}

export async function fetchBlizzardCharacter(
  name: string,
  realm: string,
): Promise<BlizzardCharacter | null> {
  const slug = realm.toLowerCase().replace(/\s+/g, '-');
  return apiGet<BlizzardCharacter>(
    `/profile/wow/character/${slug}/${name.toLowerCase()}`,
  );
}

export interface GuildRoster {
  guild: { name: string; realm: { name: string } };
  members: {
    character: {
      name: string;
      level: number;
      realm: { slug: string };
      playable_class: { id: number };
    };
    rank: number;
  }[];
}

export async function fetchGuildRoster(): Promise<GuildRoster | null> {
  const slug = config.guild.realm.toLowerCase().replace(/\s+/g, '-');
  const guildSlug = config.guild.name.toLowerCase().replace(/\s+/g, '-');
  return apiGet<GuildRoster>(
    `/data/wow/guild/${slug}/${guildSlug}/roster`,
    { namespace: `profile-${config.guild.region}` },
  );
}

export function isBlizzardConfigured(): boolean {
  return !!(config.blizzard.clientId && config.blizzard.clientSecret);
}

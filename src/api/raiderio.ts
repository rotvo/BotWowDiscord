export interface RaiderIOProfile {
  name: string;
  race: string;
  class: string;
  active_spec_name: string | null;
  active_spec_role: string | null;
  gender: string;
  faction: string | null;
  achievement_points: number;
  region: string;
  realm: string;
  gear: {
    item_level_equipped: number;
    item_level_total: number;
  };
  mythic_plus_scores_by_season: {
    season: string;
    scores: {
      all: number;
      dps: number;
      healer: number;
      tank: number;
    };
  }[];
  mythic_plus_best_runs: {
    dungeon: string;
    short_name: string;
    mythic_level: number;
    num_keystone_upgrades: number;
    score: number;
    affixes: { name: string }[];
  }[];
  raid_progression: Record<string, {
    summary: string;
    total_bosses: number;
    normal_bosses_killed: number;
    heroic_bosses_killed: number;
    mythic_bosses_killed: number;
  }>;
  profile_url: string;
  thumbnail_url: string;
}

const BASE_URL = 'https://raider.io/api/v1';
const CACHE = new Map<string, { data: RaiderIOProfile; expires: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 min

export async function fetchCharacter(
  name: string,
  realm: string,
  region: string = 'us',
): Promise<RaiderIOProfile | null> {
  const key = `${region}-${realm}-${name}`.toLowerCase();
  const cached = CACHE.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;

  const params = new URLSearchParams({
    region,
    realm,
    name,
    fields: 'gear,mythic_plus_scores_by_season:current,mythic_plus_best_runs:all,raid_progression',
  });

  try {
    const res = await fetch(`${BASE_URL}/characters/profile?${params}`);
    if (!res.ok) return null;

    const data = (await res.json()) as RaiderIOProfile;
    CACHE.set(key, { data, expires: Date.now() + CACHE_TTL });
    return data;
  } catch (err) {
    console.error('[RaiderIO]', err);
    return null;
  }
}

export interface RaiderIOAffixes {
  title: string;
  affix_details: {
    id: number;
    name: string;
    description: string;
    icon: string;
  }[];
}

export async function fetchCurrentAffixes(region: string = 'us'): Promise<RaiderIOAffixes | null> {
  try {
    const params = new URLSearchParams({ region, locale: 'es' });
    const res = await fetch(`${BASE_URL}/mythic-plus/affixes?${params}`);
    if (!res.ok) return null;
    return (await res.json()) as RaiderIOAffixes;
  } catch (err) {
    console.error('[RaiderIO Affixes]', err);
    return null;
  }
}

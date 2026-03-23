import path from 'path';
import dotenv from 'dotenv';

// Cargar .env desde la raíz del proyecto (donde está package.json)
const envPath = path.resolve(process.cwd(), '.env');
const result = dotenv.config({ path: envPath, quiet: true });
if (result.error && !result.error.message.includes('ENOENT') && process.env.NODE_ENV !== 'test') {
  console.warn('[Config] No se pudo cargar .env:', result.error.message);
}

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  discord: {
    token: required('DISCORD_TOKEN'),
    clientId: required('DISCORD_CLIENT_ID'),
    guildId: required('GUILD_ID'),
  },
  blizzard: {
    clientId: process.env.BLIZZARD_CLIENT_ID ?? '',
    clientSecret: process.env.BLIZZARD_CLIENT_SECRET ?? '',
  },
  warcraftlogs: {
    clientId: process.env.WARCRAFTLOGS_CLIENT_ID ?? '',
    clientSecret: process.env.WARCRAFTLOGS_CLIENT_SECRET ?? '',
  },
  twitch: {
    clientId: process.env.TWITCH_CLIENT_ID ?? '',
    clientSecret: process.env.TWITCH_CLIENT_SECRET ?? '',
    channel: process.env.TWITCH_CHANNEL ?? '',
  },
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY ?? '',
    channelId: process.env.YOUTUBE_CHANNEL_ID ?? '',
  },
  guild: {
    name: process.env.GUILD_NAME ?? 'Mi Guild',
    realm: process.env.GUILD_REALM ?? 'unknown',
    region: (process.env.GUILD_REGION ?? 'us') as 'us' | 'eu' | 'kr' | 'tw',
  },
  /** Canal privado donde Raider.IO publica; el bot reenvía al canal objetivo. Vacío = desactivado. */
  raiderio: {
    sourceChannel: process.env.RAIDERIO_SOURCE_CHANNEL ?? '',
    targetChannel: process.env.RAIDERIO_TARGET_CHANNEL ?? '',
    mentionRoleName: process.env.RAIDERIO_MENTION_ROLE ?? 'Miticas+',
  },
  /** Discord ID del admin que recibe DM cuando alguien acepta T&C del core. Vacío = desactivado. */
  coreNotifyUserId: process.env.CORE_NOTIFY_DISCORD_ID ?? '',
  /** Horario del core (tu zona). CORE_RAID_UTC_OFFSET: Gómez Palacio/México = -6. Discord muestra la hora en la zona de quien ve. */
  coreRaid: {
    days: (process.env.CORE_RAID_DAYS ?? '2,3').split(',').map((d) => parseInt(d.trim(), 10)).filter((d) => d >= 1 && d <= 7),
    hour: parseInt(process.env.CORE_RAID_HOUR ?? '21', 10),
    endHour: parseInt(process.env.CORE_RAID_END_HOUR ?? '23', 10),
    minute: parseInt(process.env.CORE_RAID_MINUTE ?? '0', 10),
    utcOffsetHours: parseInt(process.env.CORE_RAID_UTC_OFFSET ?? '-6', 10),
  },
} as const;

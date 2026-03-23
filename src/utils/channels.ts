import type { Guild, GuildBasedChannel } from 'discord.js';

/** Nombre lógico -> nombre con emoji para la lista de canales */
export const CHANNEL_DISPLAY_NAMES: Record<string, string> = {
  'log-moderacion': '📋 log-moderacion',
  'log-audit': '🔒 log-audit',
  'chat-general': '💬 chat-general',
  'chat-general-wow': '⚔️ chat-general-wow',
  'memes': '😂 memes',
  'chamba': '💼 chamba',
  'reglas': '📜 reglas',
  'bienvenida': '👋 bienvenida',
  'nuevos-personajes': '🛡️ nuevos-personajes',
  'roles': '🎮 roles',
  'anuncios-raid': '📢 anuncios-raid',
  'asistencia-raid': '📅 asistencia-raid',
  'core-raid': '🏰 core-raid',
  'buscar-grupo': '🔑 buscar-grupo',
  'crafting-orders': '⚒️ crafting-orders',
  'profesiones-chat': '📦 profesiones-chat',
};

const N = (s: string) => s.normalize('NFC');
const normalizeDashes = (s: string) => s.replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-');

/**
 * Dado el nombre que tiene un canal (con o sin emoji), devuelve el nombre lógico si coincide con alguno conocido.
 * Coincide: "crafting-orders", "💬 chat-general", " -chat-general", "⚔️-chat-general-wow" (emoji-guion-nombre).
 */
export function getLogicalNameFromChannelName(channelName: string): string | null {
  const raw = N(channelName).trim();
  const cn = normalizeDashes(raw);
  const stripped = cn.replace(/^[\s\-.,:;]+/u, '').trim();
  for (const [logical, display] of Object.entries(CHANNEL_DISPLAY_NAMES)) {
    if (cn === N(logical) || cn === N(display)) return logical;
    if (stripped === N(logical) || stripped === N(display)) return logical;
    const afterSpace = cn.includes(' ') ? cn.split(' ').slice(1).join(' ').trim() : '';
    if (afterSpace && N(afterSpace) === N(logical)) return logical;
    const afterSpaceStripped = stripped.includes(' ') ? stripped.split(' ').slice(1).join(' ').trim() : '';
    if (afterSpaceStripped && N(afterSpaceStripped) === N(logical)) return logical;
    if (cn.includes('-')) {
      const afterFirstDash = cn.substring(cn.indexOf('-') + 1).trim();
      if (afterFirstDash && N(afterFirstDash) === N(logical)) return logical;
    }
  }
  return null;
}

/**
 * Busca un canal por nombre lógico. Encuentra "crafting-orders", "⚒️ crafting-orders" y variantes.
 */
export function findChannelByName(guild: Guild, logicalName: string): GuildBasedChannel | null {
  const ch = guild.channels.cache.find((c) => getLogicalNameFromChannelName(c.name) === logicalName);
  if (ch) return ch;
  const displayName = CHANNEL_DISPLAY_NAMES[logicalName];
  const logicalNorm = N(logicalName);
  const displayNorm = displayName ? N(displayName) : '';
  const ch2 = guild.channels.cache.find(
    (c) => N(c.name) === logicalNorm || (displayNorm && N(c.name) === displayNorm),
  );
  return ch2 ?? null;
}

export function getChannelDisplayName(logicalName: string): string {
  return CHANNEL_DISPLAY_NAMES[logicalName] ?? logicalName;
}

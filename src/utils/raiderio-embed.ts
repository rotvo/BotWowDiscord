import { EmbedBuilder } from 'discord.js';
import type { APIEmbed, Embed } from 'discord.js';
import { getDb } from '../db/database.js';
import { EMBED_COLORS } from './constants.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extrae [text](url) → { text, url } de un string con un link markdown */
function extractLink(s: string): { text: string; url: string } | null {
  const m = s.match(/\[([^\]]+)\]\(([^)]+)\)/);
  return m ? { text: m[1], url: m[2] } : null;
}

/** Quita markdown de formato (bold, italic, strike, underline) pero NO links */
function stripFormatting(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/~~(.+?)~~/g, '$1');
}

/** Quita todo el markdown incluyendo links: [text](url)→text */
function stripAllMarkdown(s: string): string {
  return stripFormatting(s).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

/** Quita emoji unicode del inicio de un string */
function stripLeadingEmoji(s: string): string {
  return s.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '').trim();
}

// ── Regex ────────────────────────────────────────────────────────────────────

const PLAYER_LINE_PLAIN = /^(.+?)\s+-\s+(Tank|Healer|DPS)\s+\(([^)]+)\)(?:\s*[-–]\s*(\d+)\s*Score)?/im;
const PLAYER_LINE_LOOSE = /^(.+?)\s+-\s+(Tank|Healer|DPS)(?:\s+\(([^)]+)\))?(?:\s*[-–]\s*(\d+)\s*Score)?/im;
const TITLE_RUN = /Guild Run!?\s*\+(\d+)\s+(.+?)\s*\(([^)]+)\)/i;
const CLEARED_LINE = /Cleared in (\d{1,2}:\d{2})\s+of\s+(\d{1,2}:\d{2})\s*\(([^)]+)\)(?:\s*for\s*(\d+)\s*Points?)?/i;
const CLEARED_LINE_ALT = /Cleared in (\d{1,2}:\d{2})\s+of\s+(\d{1,2}:\d{2})/i;

// ── Types ────────────────────────────────────────────────────────────────────

export interface ParsedPlayer {
  name: string;
  url: string | null;
  role: string;
  specClass: string;
  score: string | null;
}

export interface ParsedRun {
  keyLevel: number;
  dungeonName: string;
  time: string;
  limit: string;
  overText: string | null;
  points: number | null;
  players: ParsedPlayer[];
  affixes: string[];
  affixUrl: string | null;
  imageUrl: string | null;
}

// ── Embed text helpers ───────────────────────────────────────────────────────

function getEmbedText(embed: APIEmbed | Embed): string {
  const parts: string[] = [];
  if (embed.title) parts.push(embed.title);
  if (embed.description) parts.push(embed.description);
  for (const f of embed.fields ?? []) {
    if (f.name) parts.push(f.name);
    if (f.value) parts.push(f.value);
  }
  return parts.join('\n');
}

function getEmbedImageUrl(embed: APIEmbed | Embed): string | null {
  const e = embed as { image?: { url?: string }; thumbnail?: { url?: string } };
  return e.image?.url ?? e.thumbnail?.url ?? null;
}

// ── Known affixes ────────────────────────────────────────────────────────────

const KNOWN_AFFIXES = [
  'Fortified', 'Tyrannical', 'Ascendant', 'Bursting', 'Bolstering', 'Raging',
  'Sanguine', 'Spiteful', 'Grievous', 'Explosive', 'Quaking', 'Storming',
  'Volcanic', 'Necrotic', 'Inspiring', 'Prideful', 'Infernal', 'Encrypted',
  'Shrouded', 'Thundering', 'Afflicted', 'Entangling', 'Incorporeal',
  "Xal'atath's Bargain", "Xal'atath's Guile", "Xal'atath's Devour",
  "Challenger's Peril", 'Focused Fury',
];

function extractAffixes(plainText: string): string[] {
  const affixes: string[] = [];
  for (const affix of KNOWN_AFFIXES) {
    if (plainText.toLowerCase().includes(affix.toLowerCase()) && !affixes.includes(affix)) {
      affixes.push(affix);
    }
  }
  return affixes;
}

/** Busca el link de "Group Details" en el texto raw del embed para usarlo en afijos */
function extractAffixUrl(rawText: string): string | null {
  const m = rawText.match(/\[Group Details[^\]]*\]\(([^)]+)\)/i)
    ?? rawText.match(/\[.*(?:Fortified|Tyrannical).*\]\(([^)]+)\)/i);
  return m ? m[1] : null;
}

// ── Player parsing ───────────────────────────────────────────────────────────

function parsePlayerLine(rawLine: string): ParsedPlayer | null {
  const line = stripFormatting(rawLine.trim());

  // Extraer URL del nombre si es link markdown: [Name](url) - Role (Spec) - Score
  let playerUrl: string | null = null;
  const linkMatch = extractLink(line);

  // Convertir links a texto plano para regex
  const plain = stripLeadingEmoji(line.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'));

  const m = plain.match(PLAYER_LINE_PLAIN) ?? plain.match(PLAYER_LINE_LOOSE);
  if (!m) return null;

  const name = m[1].trim();
  if (name.length === 0 || name.length > 50) return null;

  // Si el link contenía el nombre del jugador, usamos esa URL
  if (linkMatch && name.toLowerCase().includes(linkMatch.text.toLowerCase().trim())) {
    playerUrl = linkMatch.url;
  } else if (linkMatch) {
    playerUrl = linkMatch.url;
  }

  return {
    name,
    url: playerUrl,
    role: m[2],
    specClass: (m[3] ?? '—').trim(),
    score: m[4] ?? null,
  };
}

// ── Main parser ──────────────────────────────────────────────────────────────

export function parseRaiderIORunEmbed(embeds: APIEmbed[] | Embed[]): ParsedRun | null {
  const embed = embeds[0];
  if (!embed) return null;
  const rawText = getEmbedText(embed);
  const plainText = stripAllMarkdown(rawText);
  const title = stripAllMarkdown((embed as { title?: string }).title ?? '');

  const titleMatch = title.match(TITLE_RUN);
  const keyLevel = titleMatch ? parseInt(titleMatch[1], 10) : 0;
  const dungeonName = titleMatch ? titleMatch[2].trim() : title.replace(/Guild Run!?\s*/i, '').trim() || 'M+';

  let time = '';
  let limit = '';
  let overText: string | null = null;
  let points: number | null = null;
  const textNorm = plainText.replace(/\r?\n/g, ' ');
  const clearedMatch = textNorm.match(CLEARED_LINE) ?? textNorm.match(CLEARED_LINE_ALT);
  if (clearedMatch) {
    time = clearedMatch[1].trim();
    limit = clearedMatch[2].trim();
    if (clearedMatch[3]) overText = clearedMatch[3].trim();
    if (clearedMatch[4]) points = parseInt(clearedMatch[4], 10);
  }

  const players: ParsedPlayer[] = [];
  const seenNames = new Set<string>();
  for (const line of rawText.split(/\r?\n/)) {
    const p = parsePlayerLine(line);
    if (p && !seenNames.has(p.name.toLowerCase())) {
      seenNames.add(p.name.toLowerCase());
      players.push(p);
    }
  }

  const affixes = extractAffixes(plainText);
  const affixUrl = extractAffixUrl(rawText);
  const imageUrl = getEmbedImageUrl(embed);

  return { keyLevel, dungeonName, time, limit, overText, points, players, affixes, affixUrl, imageUrl };
}

// ── Custom embed builder ─────────────────────────────────────────────────────

export function buildCustomRunEmbed(parsed: ParsedRun): EmbedBuilder {
  const fueraDeTiempo = !!(parsed.overText && /over/i.test(parsed.overText));

  const title = `Run +${parsed.keyLevel} ${parsed.dungeonName}`;
  const embed = new EmbedBuilder()
    .setColor(fueraDeTiempo ? EMBED_COLORS.danger : EMBED_COLORS.success)
    .setTitle(title)
    .setTimestamp();

  const descParts: string[] = [];
  if (parsed.time && parsed.limit) {
    descParts.push(`**Tiempo:** ${parsed.time} / ${parsed.limit}`);
    if (fueraDeTiempo) {
      descParts.push(`❌ Fuera de tiempo (${parsed.overText})`);
    } else {
      descParts.push('✅ Completado a tiempo');
    }
    if (parsed.points != null) descParts.push(`**${parsed.points}** pts`);
  }
  if (descParts.length > 0) embed.setDescription(descParts.join('\n'));

  if (parsed.players.length > 0) {
    const roleEmoji: Record<string, string> = { Tank: '🛡️', Healer: '💚', DPS: '⚔️' };
    const groupLines = parsed.players.map((p) => {
      const nameDisplay = p.url ? `[${p.name}](${p.url})` : `**${p.name}**`;
      const scorePart = p.score ? ` — ${p.score}` : '';
      return `${roleEmoji[p.role] ?? '•'} ${nameDisplay} — ${p.role} (${p.specClass})${scorePart}`;
    });
    embed.addFields({ name: 'Participantes', value: groupLines.join('\n'), inline: false });
  }

  if (parsed.affixes.length > 0) {
    const affixList = parsed.affixes.map((a) => {
      if (parsed.affixUrl) return `• [${a}](${parsed.affixUrl})`;
      return `• ${a}`;
    }).join('\n');
    embed.addFields({ name: 'Afijos', value: affixList, inline: false });
  }

  if (parsed.imageUrl) embed.setImage(parsed.imageUrl);
  embed.setFooter({ text: 'Datos: Raider.IO' });

  return embed;
}

// ── Mention helpers ──────────────────────────────────────────────────────────

export function buildRunMentionPrefix(
  roleMention: string | null,
  discordIds: string[],
): string {
  const parts: string[] = [];
  if (roleMention) parts.push(roleMention);
  for (const id of discordIds) parts.push(`<@${id}>`);
  return parts.length > 0 ? parts.join(' ') + ' ' : '';
}

export function extractCharacterNamesFromEmbeds(embeds: APIEmbed[] | Embed[]): string[] {
  const names = new Set<string>();
  for (const embed of embeds) {
    const rawText = getEmbedText(embed);
    for (const line of rawText.split(/\r?\n/)) {
      const p = parsePlayerLine(line);
      if (p) names.add(p.name);
    }
  }
  return [...names];
}

export function getDiscordIdsForCharacterNames(characterNames: string[]): string[] {
  if (characterNames.length === 0) return [];
  const db = getDb();
  const stmt = db.prepare(
    `SELECT DISTINCT discord_id FROM characters WHERE LOWER(TRIM(wow_character)) = LOWER(TRIM(?))`,
  );
  const ids = new Set<string>();
  for (const name of characterNames) {
    const row = stmt.get(name) as { discord_id: string } | undefined;
    if (row) ids.add(row.discord_id);
  }
  return [...ids];
}

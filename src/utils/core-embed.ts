import { EmbedBuilder, type Client } from 'discord.js';
import { getDb } from '../db/database.js';
import { WOW_CLASS_COLORS, EMBED_COLORS } from './constants.js';
import { CLASS_NAME_ES, analyzeTierTokenCoverage } from './wow-buffs.js';
import { type CharacterRow } from '../bot/commands/vincular.js';
import { config } from '../config.js';

export interface CoreMemberRow {
  id: number;
  discord_id: string;
  character_id: number;
  role: string;
  joined_at: string;
}

interface CoreMemberFull extends CoreMemberRow {
  wow_character: string;
  wow_realm: string;
  wow_class: string;
  wow_spec: string;
  ilvl: number;
}

function getCoreMembers(): CoreMemberFull[] {
  const db = getDb();
  return db.prepare(`
    SELECT cm.*, c.wow_character, c.wow_realm, c.wow_class, c.wow_spec, c.ilvl
    FROM core_members cm
    JOIN characters c ON cm.character_id = c.id
    ORDER BY c.ilvl DESC
  `).all() as CoreMemberFull[];
}

function formatMember(m: CoreMemberFull): string {
  return `<@${m.discord_id}> — ${m.wow_class} ${m.wow_spec} — ${m.ilvl} ilvl`;
}

function formatMemberList(members: CoreMemberFull[]): string {
  if (members.length === 0) return '*Sin miembros*';
  return members.map((m, i) => {
    const connector = i === members.length - 1 ? '┗' : '┣';
    return `${connector} ${formatMember(m)}`;
  }).join('\n');
}

function classBreakdown(members: CoreMemberFull[]): string {
  if (members.length === 0) return '';
  const counts = new Map<string, number>();
  for (const m of members) {
    const cls = m.wow_class ?? 'Desconocido';
    counts.set(cls, (counts.get(cls) ?? 0) + 1);
  }
  const parts: string[] = [];
  for (const [cls, count] of counts) {
    const nameEs = CLASS_NAME_ES[cls] ?? cls;
    parts.push(`${count}x ${nameEs}`);
  }
  return `*(${parts.join(', ')})*`;
}

/** Días de la semana para mostrar (1 = Lunes … 7 = Domingo). */
const DAY_NAMES_ES: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

/**
 * Calcula el próximo evento para un día de la semana a una hora local (con offset UTC)
 * y devuelve el timestamp Unix. Discord luego muestra <t:unix:F> en la zona horaria de quien ve el mensaje.
 */
function getNextRaidUnix(dayOfWeek: number, hour: number, minute: number, utcOffsetHours: number): number {
  const now = new Date();
  const utcHour = (hour - utcOffsetHours + 24) % 24;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour, minute, 0, 0));
  let diff = (dayOfWeek === 7 ? 0 : dayOfWeek) - d.getUTCDay();
  if (diff < 0) diff += 7;
  if (diff === 0 && d.getTime() <= now.getTime()) diff = 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return Math.floor(d.getTime() / 1000);
}

/** Horario con timestamps de Discord: tú seteas 21–23 en tu zona (México); cada quien lo ve en su hora. */
function buildScheduleLine(): string {
  const { coreRaid } = config;
  const offset = coreRaid.utcOffsetHours ?? -6;
  const lines: string[] = [];
  for (const day of coreRaid.days.length ? coreRaid.days : [2, 3]) {
    const unixStart = getNextRaidUnix(day, coreRaid.hour, coreRaid.minute, offset);
    const unixEnd = getNextRaidUnix(day, coreRaid.endHour, 0, offset);
    const name = DAY_NAMES_ES[day] ?? `Día ${day}`;
    lines.push(`${name}: <t:${unixStart}:t> – <t:${unixEnd}:t> (en tu zona)`);
  }
  return lines.join('\n');
}

export function buildCoreEmbed(): EmbedBuilder {
  const members = getCoreMembers();

  const tanks = members.filter((m) => m.role === 'Tank');
  const healers = members.filter((m) => m.role === 'Healer');
  const melee = members.filter((m) => m.role === 'DPS Melee');
  const ranged = members.filter((m) => m.role === 'DPS Ranged');

  const classesPresent = new Set(members.map((m) => m.wow_class).filter(Boolean));

  const avgIlvl = members.length > 0
    ? Math.round(members.reduce((sum, m) => sum + m.ilvl, 0) / members.length)
    : 0;

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.wow)
    .setTitle('🏰 CORE RAID')
    .setDescription(
      '━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      `**Total:** ${members.length} miembros` +
      (members.length > 0 ? ` · **iLvl Promedio:** ${avgIlvl}` : '') +
      '\n━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '**HORARIO DE LA RAID**\n' +
      buildScheduleLine() +
      '\n━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '*Haz clic en los botones de abajo para inscribirte o salir del core.*',
    );

  embed.addFields({
    name: `🛡️ TANQUES (${tanks.length})  ${classBreakdown(tanks)}`,
    value: formatMemberList(tanks),
    inline: false,
  });

  embed.addFields({
    name: `💚 HEALERS (${healers.length})  ${classBreakdown(healers)}`,
    value: formatMemberList(healers),
    inline: false,
  });

  embed.addFields({
    name: `⚔️ DPS MELEE (${melee.length})  ${classBreakdown(melee)}`,
    value: formatMemberList(melee),
    inline: false,
  });

  embed.addFields({
    name: `🏹 DPS RANGED (${ranged.length})  ${classBreakdown(ranged)}`,
    value: formatMemberList(ranged),
    inline: false,
  });

  if (members.length > 0) {
    const tierCoverage = analyzeTierTokenCoverage(classesPresent);
    const tierLines = tierCoverage.map((t) => {
      const classNames = t.classesPresent.map((c) => CLASS_NAME_ES[c] ?? c).join(', ');
      const status = t.count > 0 ? '✅' : '❌';
      const detail = t.count > 0 ? `${t.count} (${classNames})` : 'Sin cobertura';
      return `${status} ${t.token.icon} **${t.token.name}** (${t.token.armorType}): ${detail}`;
    });

    embed.addFields({
      name: '🎖️ TIER TOKENS',
      value: tierLines.join('\n'),
      inline: false,
    });
  }

  embed.setFooter({
    text: `Core Raid · ${members.length} miembros · Última actualización`,
  });
  embed.setTimestamp();

  return embed;
}

export function addCoreMember(discordId: string, characterId: number, role: string): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO core_members (discord_id, character_id, role)
    VALUES (?, ?, ?)
    ON CONFLICT(discord_id)
    DO UPDATE SET character_id = excluded.character_id,
                  role = excluded.role,
                  joined_at = datetime('now')
  `).run(discordId, characterId, role);
}

export function removeCoreMember(discordId: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM core_members WHERE discord_id = ?').run(discordId);
  return result.changes > 0;
}

export function getCoreMember(discordId: string): CoreMemberRow | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM core_members WHERE discord_id = ?').get(discordId) as CoreMemberRow) ?? null;
}

export function getCoreConfig(guildId: string): { channel_id: string | null; message_id: string | null } {
  const db = getDb();
  const row = db.prepare('SELECT * FROM core_config WHERE guild_id = ?').get(guildId) as {
    guild_id: string;
    channel_id: string | null;
    message_id: string | null;
  } | undefined;
  return row ?? { channel_id: null, message_id: null };
}

export function setCoreConfig(guildId: string, channelId: string, messageId: string): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO core_config (guild_id, channel_id, message_id)
    VALUES (?, ?, ?)
    ON CONFLICT(guild_id)
    DO UPDATE SET channel_id = excluded.channel_id,
                  message_id = excluded.message_id
  `).run(guildId, channelId, messageId);
}

/**
 * Actualiza el mensaje embed del core en el canal. Devuelve true si tuvo éxito.
 */
export async function refreshCoreMessage(guild: import('discord.js').Guild): Promise<boolean> {
  const cfg = getCoreConfig(guild.id);
  if (!cfg.channel_id || !cfg.message_id) return false;

  try {
    const channel = guild.channels.cache.get(cfg.channel_id);
    if (!channel?.isTextBased()) return false;
    const msg = await channel.messages.fetch(cfg.message_id);
    await msg.edit({ embeds: [buildCoreEmbed()] });
    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════
//  Términos y condiciones
// ═══════════════════════════════════════════════════════

export function hasAcceptedTerms(discordId: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT 1 FROM core_terms_acceptances WHERE discord_id = ?').get(discordId);
  return !!row;
}

export function acceptTerms(discordId: string): void {
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO core_terms_acceptances (discord_id) VALUES (?)`,
  ).run(discordId);
}

export function setPendingSignup(discordId: string, role: string): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO core_pending_signup (discord_id, role)
     VALUES (?, ?)
     ON CONFLICT(discord_id)
     DO UPDATE SET role = excluded.role, created_at = datetime('now')`,
  ).run(discordId, role);
}

export function getPendingSignup(discordId: string): { role: string } | null {
  const db = getDb();
  const row = db.prepare('SELECT role FROM core_pending_signup WHERE discord_id = ?').get(discordId) as { role: string } | undefined;
  return row ?? null;
}

export function clearPendingSignup(discordId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM core_pending_signup WHERE discord_id = ?').run(discordId);
}

// ═══════════════════════════════════════════════════════
//  Notificación al admin por DM
// ═══════════════════════════════════════════════════════

export async function notifyAdminCoreSignup(
  client: Client,
  discordId: string,
  userName: string,
  role: string,
  characterName: string,
): Promise<void> {
  const adminId = config.coreNotifyUserId;
  if (!adminId) return;

  try {
    const admin = await client.users.fetch(adminId);
    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.warning)
      .setTitle('Nuevo miembro en el Core Raid')
      .setDescription(
        `**${userName}** (<@${discordId}>) aceptó los términos y condiciones del Core.\n\n` +
        `**Rol:** ${role}\n` +
        `**Personaje:** ${characterName}\n\n` +
        `Necesita entrevista.`,
      )
      .setTimestamp();
    await admin.send({ embeds: [embed] });
  } catch (err) {
    console.warn('[Core] No se pudo enviar DM al admin:', err);
  }
}

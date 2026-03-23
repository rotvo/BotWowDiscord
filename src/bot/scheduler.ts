import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { getDb } from '../db/database.js';
import { config } from '../config.js';
import { EMBED_COLORS } from '../utils/constants.js';
import { findChannelByName } from '../utils/channels.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

let raidCheckInterval: ReturnType<typeof setInterval> | null = null;
let resetCheckInterval: ReturnType<typeof setInterval> | null = null;
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function getGuild(client: Client) {
  return client.guilds.cache.get(config.discord.guildId);
}

function findChannel(client: Client, name: string): TextChannel | null {
  const guild = getGuild(client);
  if (!guild) return null;
  const ch = findChannelByName(guild, name);
  return ch?.isTextBased() ? (ch as TextChannel) : null;
}

async function checkRaidReminders(client: Client): Promise<void> {
  const db = getDb();
  const now = new Date();
  const twoHoursLater = new Date(now.getTime() + 2 * HOUR);

  const upcomingRaids = db
    .prepare(
      `SELECT r.id, r.title, r.difficulty, r.scheduled_at, r.channel_id,
              (SELECT COUNT(*) FROM raid_signups WHERE raid_id = r.id) as signup_count
       FROM raids r
       WHERE r.status = 'scheduled'
         AND datetime(r.scheduled_at) > datetime(?)
         AND datetime(r.scheduled_at) <= datetime(?)`,
    )
    .all(
      now.toISOString(),
      twoHoursLater.toISOString(),
    ) as {
    id: number;
    title: string;
    difficulty: string;
    scheduled_at: string;
    channel_id: string | null;
    signup_count: number;
  }[];

  const alreadyNotified = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='raid_reminders_sent'`,
  ).get();

  if (!alreadyNotified) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS raid_reminders_sent (
        raid_id INTEGER PRIMARY KEY,
        sent_at TEXT DEFAULT (datetime('now'))
      )
    `);
  }

  for (const raid of upcomingRaids) {
    const already = db
      .prepare(`SELECT raid_id FROM raid_reminders_sent WHERE raid_id = ?`)
      .get(raid.id);
    if (already) continue;

    const channel = findChannel(client, 'anuncios-raid') ?? findChannel(client, 'chat-general');
    if (!channel) continue;

    const scheduledTs = Math.floor(new Date(raid.scheduled_at).getTime() / 1000);
    const raiderRole = getGuild(client)?.roles.cache.find((r) => r.name === 'Raider');
    const mention = raiderRole ? `${raiderRole}` : '@here';

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.warning)
      .setTitle('Recordatorio de Raid')
      .setDescription(
        `${mention}\n\n` +
        `**${raid.title}** (${raid.difficulty}) empieza <t:${scheduledTs}:R>!\n\n` +
        `Inscritos: **${raid.signup_count}** jugadores\n` +
        `Hora: <t:${scheduledTs}:F>\n\n` +
        `Ven preparado: consumibles, enchants, gemas y conoce las mecanicas.`,
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    db.prepare(`INSERT OR IGNORE INTO raid_reminders_sent (raid_id) VALUES (?)`).run(raid.id);

    const signups = db.prepare(
      `SELECT DISTINCT discord_id FROM raid_signups WHERE raid_id = ? AND status = 'confirmed'`,
    ).all(raid.id) as { discord_id: string }[];

    const scheduledDate = new Date(raid.scheduled_at);
    const timeStr = `<t:${Math.floor(scheduledDate.getTime() / 1000)}:R>`;

    for (const signup of signups) {
      try {
        const user = await client.users.fetch(signup.discord_id);
        await user.send({
          embeds: [new EmbedBuilder()
            .setColor(EMBED_COLORS.warning)
            .setTitle('Recordatorio de Raid')
            .setDescription(
              `**${raid.title}** (${raid.difficulty}) empieza ${timeStr}.\n\n` +
              `Recuerda venir preparado: consumibles, enchants, gemas y conoce las mecanicas.`,
            )
            .setTimestamp()],
        });
      } catch {
        // User may have DMs disabled or left server
      }
    }
  }
}

function getNextResetDay(): Date {
  const now = new Date();
  const utcDay = now.getUTCDay();
  const utcHour = now.getUTCHours();

  // NA reset: Tuesday 15:00 UTC (10am EST)
  let daysUntilTuesday = (2 - utcDay + 7) % 7;
  if (daysUntilTuesday === 0 && utcHour >= 15) {
    daysUntilTuesday = 7;
  }

  const next = new Date(now);
  next.setUTCDate(now.getUTCDate() + daysUntilTuesday);
  next.setUTCHours(15, 0, 0, 0);
  return next;
}

let lastResetWeek = -1;

async function checkWeeklyReset(client: Client): Promise<void> {
  const now = new Date();
  const nextReset = getNextResetDay();
  const diff = nextReset.getTime() - now.getTime();

  const currentWeek = getISOWeek(now);
  if (currentWeek === lastResetWeek) return;

  // Post 1 hour before reset or right after
  if (diff > 0 && diff <= HOUR) {
    lastResetWeek = currentWeek;

    const channel = findChannel(client, 'anuncios-raid') ?? findChannel(client, 'chat-general');
    if (!channel) return;

    const resetTs = Math.floor(nextReset.getTime() / 1000);

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.wow)
      .setTitle('Reset Semanal')
      .setDescription(
        `El reset semanal es <t:${resetTs}:R>!\n\n` +
        `**No olvides:**\n` +
        `> Abrir tu Great Vault\n` +
        `> Completar tu M+ semanal\n` +
        `> Revisar tus world quests\n` +
        `> Hacer tu raid semanal si te falta\n` +
        `> Entregar crafting orders pendientes`,
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  }
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function cleanupOldData(): void {
  try {
    const db = getDb();
    const cutoff = new Date(Date.now() - 30 * 24 * HOUR).toISOString();

    const raidResult = db.prepare(
      `DELETE FROM raids WHERE status IN ('completed', 'cancelled') AND datetime(scheduled_at) < datetime(?)`,
    ).run(cutoff);

    const mplusResult = db.prepare(
      `DELETE FROM mplus_groups WHERE status IN ('complete', 'closed') AND datetime(created_at) < datetime(?)`,
    ).run(cutoff);

    const craftResult = db.prepare(
      `DELETE FROM crafting_orders WHERE status IN ('completed', 'cancelled') AND datetime(created_at) < datetime(?)`,
    ).run(cutoff);

    const total = (raidResult.changes ?? 0) + (mplusResult.changes ?? 0) + (craftResult.changes ?? 0);
    if (total > 0) {
      console.log(`[Cleanup] Eliminados: ${raidResult.changes} raids, ${mplusResult.changes} grupos M+, ${craftResult.changes} crafting orders (>30 dias)`);
    }
  } catch (err) {
    console.error('[Cleanup] Error:', err);
  }
}

export function startScheduler(client: Client): void {
  console.log('[Scheduler] Iniciando tareas programadas...');

  raidCheckInterval = setInterval(() => {
    checkRaidReminders(client).catch((err) =>
      console.error('[Scheduler] Error en raid reminder:', err),
    );
  }, 5 * MINUTE);

  resetCheckInterval = setInterval(() => {
    checkWeeklyReset(client).catch((err) =>
      console.error('[Scheduler] Error en weekly reset:', err),
    );
  }, 30 * MINUTE);

  cleanupInterval = setInterval(() => {
    cleanupOldData();
  }, 24 * HOUR);

  checkRaidReminders(client).catch(console.error);
  checkWeeklyReset(client).catch(console.error);
  cleanupOldData();

  console.log('[Scheduler] Raid reminders: cada 5 min | Weekly reset: cada 30 min | Cleanup: cada 24h');
}

export function stopScheduler(): void {
  if (raidCheckInterval) clearInterval(raidCheckInterval);
  if (resetCheckInterval) clearInterval(resetCheckInterval);
  if (cleanupInterval) clearInterval(cleanupInterval);
  console.log('[Scheduler] Detenido.');
}

import {
  type StringSelectMenuInteraction,
  EmbedBuilder,
} from 'discord.js';
import { getDb } from '../../db/database.js';
import { config } from '../../config.js';
import { EMBED_COLORS } from '../../utils/constants.js';
import { errorEmbed } from '../../utils/embeds.js';
import { getDayTimestamps } from '../../utils/datetime.js';
import { getCharacterById } from '../commands/vincular.js';
import {
  CLASS_NAME_ES,
  RAID_BUFFS,
  analyzeBuffCoverage,
  analyzeTierTokenCoverage,
} from '../../utils/wow-buffs.js';

interface RaidSignup {
  discord_id: string;
  role: string;
  status: string;
  wow_class: string | null;
  wow_spec: string | null;
  ilvl: number;
  character_id: number;
}

interface Raid {
  id: number;
  title: string;
  difficulty: string;
  description: string;
  scheduled_at: string;
  created_by: string;
  min_ilvl: number;
  status: string;
  message_id: string | null;
  channel_id: string | null;
  date_end: string | null;
  start_hour: number | null;
  start_minute: number | null;
  end_hour: number | null;
  end_minute: number | null;
}

function fmtPlayer(s: RaidSignup): string {
  const mention = `<@${s.discord_id}>`;
  if (s.wow_class && s.wow_spec) {
    return `${mention} (${s.wow_class} ${s.wow_spec} - ${s.ilvl} ilvl)`;
  }
  return mention;
}

function chunkText(lines: string[], maxLen: number): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const line of lines) {
    if (current.length + line.length + 1 > maxLen) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current = current ? current + '\n' + line : line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function buildDateSection(raid: Raid): string[] {
  const offsetHours = config.coreRaid.utcOffsetHours;
  const isRange = raid.date_end != null && raid.start_hour != null;

  if (!isRange) {
    const fecha = new Date(raid.scheduled_at);
    const ts = Math.floor(fecha.getTime() / 1000);
    return [
      `**Fecha:** <t:${ts}:F>`,
      `**Countdown:** <t:${ts}:R>`,
    ];
  }

  const scheduledAt = new Date(raid.scheduled_at);
  const adjusted = new Date(scheduledAt.getTime() + offsetHours * 3600 * 1000);
  const year = adjusted.getUTCFullYear();
  const month = adjusted.getUTCMonth();
  const dayStart = adjusted.getUTCDate();
  const dateStart = new Date(Date.UTC(year, month, dayStart, 0, 0, 0));

  const endMatch = raid.date_end!.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const dateEnd = endMatch
    ? new Date(Date.UTC(parseInt(endMatch[1], 10), parseInt(endMatch[2], 10) - 1, parseInt(endMatch[3], 10), 23, 59, 59))
    : dateStart;

  const startHour = raid.start_hour ?? 21;
  const startMinute = raid.start_minute ?? 0;
  const endHour = raid.end_hour ?? 23;
  const endMinute = raid.end_minute ?? 0;

  const dayTimestamps = getDayTimestamps(dateStart, dateEnd, startHour, startMinute, offsetHours);
  const timeStr = `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')} - ${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

  if (dayTimestamps.length > 1) {
    const daysLine = dayTimestamps.map((ts) => `<t:${ts}:F>`).join(' · ');
    return [
      `**Dias:** ${daysLine}`,
      `**Horario:** ${timeStr} (cada uno ve su zona)`,
      `**Countdown:** <t:${dayTimestamps[0]}:R>`,
    ];
  }

  const ts = dayTimestamps[0];
  return [
    `**Fecha:** <t:${ts}:F>`,
    `**Horario:** ${timeStr}`,
    `**Countdown:** <t:${ts}:R>`,
  ];
}

function rebuildRaidEmbed(raid: Raid, signups: RaidSignup[]): EmbedBuilder {
  const tanks = signups.filter((s) => s.role === 'tank' && s.status === 'confirmed');
  const healers = signups.filter((s) => s.role === 'healer' && s.status === 'confirmed');
  const dps = signups.filter((s) => s.role === 'dps' && s.status === 'confirmed');
  const tentative = signups.filter((s) => s.role === 'tentative');
  const absent = signups.filter((s) => s.role === 'absent');

  const fmt = (list: RaidSignup[]) =>
    list.length > 0 ? list.map(fmtPlayer).join('\n') : '*ninguno*';

  const diffColors: Record<string, number> = {
    'Normal': 0x2ECC71,
    'Heroic': 0x9B59B6,
    'Mythic': 0xE74C3C,
  };

  const ilvlLine = raid.min_ilvl > 0 ? `**iLvl Minimo:** ${raid.min_ilvl}\n` : '';
  const dateLines = buildDateSection(raid);

  const embed = new EmbedBuilder()
    .setColor(diffColors[raid.difficulty] ?? EMBED_COLORS.wow)
    .setTitle(`${raid.title} — ${raid.difficulty}`)
    .setDescription(
      [
        raid.description ? `${raid.description}\n` : '',
        ...dateLines,
        `**Creado por:** <@${raid.created_by}>`,
        ilvlLine,
        `**Composicion:** (${tanks.length + healers.length + dps.length} total)`,
        `🛡️ Tanks (${tanks.length}):\n${fmt(tanks)}`,
        `💚 Healers (${healers.length}):\n${fmt(healers)}`,
        `⚔️ DPS (${dps.length}):\n${fmt(dps)}`,
        '',
        `⏳ Tentativos (${tentative.length}): ${tentative.length > 0 ? tentative.map((s) => `<@${s.discord_id}>`).join(', ') : '*ninguno*'}`,
        `❌ No pueden (${absent.length}): ${absent.length > 0 ? absent.map((s) => `<@${s.discord_id}>`).join(', ') : '*ninguno*'}`,
      ].join('\n'),
    );

  const confirmed = [...tanks, ...healers, ...dps];
  const classesPresent = new Set(confirmed.map((s) => s.wow_class).filter((c): c is string => !!c));

  if (classesPresent.size > 0) {
    const { covered, missing } = analyzeBuffCoverage(classesPresent);
    const buffLine = (b: (typeof RAID_BUFFS)[0]) => {
      const classes = b.providedBy.map((c) => CLASS_NAME_ES[c] ?? c).join('/');
      return `${b.icon} **${b.name}** (${classes}) — ${b.description}`;
    };

    const coveredBufDebuffs = covered.filter((b) => b.category === 'buff' || b.category === 'debuff');
    const coveredUtils = covered.filter((b) => b.category === 'utility');
    const missingBufDebuffs = missing.filter((b) => b.category === 'buff' || b.category === 'debuff');
    const missingUtils = missing.filter((b) => b.category === 'utility');

    const coveredText = [
      ...coveredBufDebuffs.map((b) => `✅ ${buffLine(b)}`),
      ...coveredUtils.map((b) => `✅ ${buffLine(b)}`),
    ];
    const missingText = [
      ...missingBufDebuffs.map((b) => `❌ ${buffLine(b)}`),
      ...missingUtils.map((b) => `❌ ${buffLine(b)}`),
    ];

    if (coveredText.length > 0) {
      for (const chunk of chunkText(coveredText, 1024)) {
        embed.addFields({ name: '✅ BUFFS Y UTILIDADES CUBIERTOS', value: chunk, inline: false });
      }
    }
    if (missingText.length > 0) {
      for (const chunk of chunkText(missingText, 1024)) {
        embed.addFields({ name: '❌ BUFFS Y UTILIDADES FALTANTES', value: chunk, inline: false });
      }
    } else {
      embed.addFields({
        name: '🎉 COBERTURA COMPLETA',
        value: '¡Todos los buffs, debuffs y utilidades están cubiertos!',
        inline: false,
      });
    }

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

  embed.setFooter({ text: `Raid ID: ${raid.id}` }).setTimestamp();
  return embed;
}

export { rebuildRaidEmbed, type RaidSignup, type Raid };

export default {
  customId: 'charsel_raid_',
  async execute(interaction: StringSelectMenuInteraction) {
    // customId format: charsel_raid_{role}_{raidId}
    const parts = interaction.customId.replace('charsel_raid_', '').split('_');
    if (parts.length < 2) return;
    const role = parts[0];
    const raidId = parseInt(parts[1], 10);
    const charId = parseInt(interaction.values[0], 10);

    const character = getCharacterById(charId);
    if (!character || character.discord_id !== interaction.user.id) {
      await interaction.reply({ embeds: [errorEmbed('Error', 'Personaje no valido.')], ephemeral: true });
      return;
    }

    const db = getDb();
    const raid = db.prepare('SELECT * FROM raids WHERE id = ?').get(raidId) as Raid | undefined;
    if (!raid) {
      await interaction.reply({ content: 'Raid no encontrado.', ephemeral: true });
      return;
    }

    if (raid.status === 'cancelled') {
      await interaction.reply({ content: 'Esta raid fue cancelada, ya no puedes anotarte.', ephemeral: true });
      return;
    }

    if (raid.min_ilvl > 0 && character.ilvl < raid.min_ilvl) {
      await interaction.reply({
        embeds: [errorEmbed(
          'iLvl Insuficiente',
          `**${character.wow_character}** tiene **${character.ilvl}** ilvl. Este raid requiere minimo **${raid.min_ilvl}**.\nUsa \`/actualizar\` si subiste de ilvl.`,
        )],
        ephemeral: true,
      });
      return;
    }

    const existing = db.prepare(
      'SELECT * FROM raid_signups WHERE raid_id = ? AND discord_id = ?',
    ).get(raidId, interaction.user.id) as RaidSignup | undefined;

    if (existing) {
      db.prepare('UPDATE raid_signups SET role = ?, status = ?, wow_class = ?, wow_spec = ?, ilvl = ?, character_id = ? WHERE raid_id = ? AND discord_id = ?')
        .run(role, 'confirmed', character.wow_class, character.wow_spec, character.ilvl, character.id, raidId, interaction.user.id);
    } else {
      db.prepare('INSERT INTO raid_signups (raid_id, discord_id, role, status, wow_class, wow_spec, ilvl, character_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(raidId, interaction.user.id, role, 'confirmed', character.wow_class, character.wow_spec, character.ilvl, character.id);
    }

    await interaction.reply({
      content: `Te apuntaste como **${role}** con **${character.wow_character}** (${character.wow_class} ${character.wow_spec} - ${character.ilvl} ilvl).`,
      ephemeral: true,
    });

    const signups = db.prepare('SELECT * FROM raid_signups WHERE raid_id = ?').all(raidId) as RaidSignup[];

    try {
      const channel = interaction.guild?.channels.cache.get(raid.channel_id ?? '');
      if (channel?.isTextBased() && raid.message_id) {
        const msg = await channel.messages.fetch(raid.message_id);
        await msg.edit({ embeds: [rebuildRaidEmbed(raid, signups)] });
      }
    } catch { /* message may not exist */ }
  },
};

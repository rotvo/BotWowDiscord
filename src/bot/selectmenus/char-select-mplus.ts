import {
  type StringSelectMenuInteraction,
  EmbedBuilder,
} from 'discord.js';
import { getDb } from '../../db/database.js';
import { EMBED_COLORS } from '../../utils/constants.js';
import { errorEmbed } from '../../utils/embeds.js';
import { getCharacterById } from '../commands/vincular.js';

interface MplusGroup {
  id: number;
  leader_id: string;
  dungeon: string;
  key_level: number;
  description: string;
  status: string;
  min_ilvl: number;
  message_id: string | null;
  channel_id: string | null;
}

interface MplusSignup {
  discord_id: string;
  role: string;
  wow_class: string | null;
  wow_spec: string | null;
  ilvl: number;
  character_id: number;
}

function fmtPlayer(s: MplusSignup): string {
  const mention = `<@${s.discord_id}>`;
  if (s.wow_class && s.wow_spec) {
    return `${mention} (${s.wow_class} ${s.wow_spec} - ${s.ilvl} ilvl)`;
  }
  return mention;
}

function rebuildMplusEmbed(group: MplusGroup, signups: MplusSignup[]): EmbedBuilder {
  const tank = signups.find((s) => s.role === 'Tank');
  const healer = signups.find((s) => s.role === 'Healer');
  const dps = signups.filter((s) => s.role === 'DPS');

  const fmt = (s: MplusSignup | undefined) => s ? fmtPlayer(s) : '*buscando...*';
  const isFull = !!tank && !!healer && dps.length >= 3;
  const ilvlLine = group.min_ilvl > 0 ? `**iLvl Minimo:** ${group.min_ilvl}\n` : '';

  return new EmbedBuilder()
    .setColor(isFull ? 0x2ECC71 : EMBED_COLORS.wow)
    .setTitle(`${isFull ? '✅ ' : ''}M+ ${group.dungeon} +${group.key_level}`)
    .setDescription(
      [
        group.description ? `${group.description}\n` : '',
        `**Lider:** <@${group.leader_id}>`,
        ilvlLine,
        '**Grupo:**',
        `🛡️ Tank: ${fmt(tank)}`,
        `💚 Healer: ${fmt(healer)}`,
        `⚔️ DPS 1: ${fmt(dps[0])}`,
        `⚔️ DPS 2: ${fmt(dps[1])}`,
        `⚔️ DPS 3: ${fmt(dps[2])}`,
        '',
        isFull ? '**¡Grupo completo!**' : `**${5 - signups.length} lugares disponibles**`,
      ].join('\n'),
    )
    .setFooter({ text: `Grupo ID: ${group.id}` })
    .setTimestamp();
}

export { rebuildMplusEmbed, type MplusSignup, type MplusGroup };

export default {
  customId: 'charsel_mplus_',
  async execute(interaction: StringSelectMenuInteraction) {
    // customId format: charsel_mplus_{role}_{groupId}
    const parts = interaction.customId.replace('charsel_mplus_', '').split('_');
    if (parts.length < 2) return;
    const roleName = parts[0];
    const groupId = parseInt(parts[1], 10);
    const charId = parseInt(interaction.values[0], 10);

    const character = getCharacterById(charId);
    if (!character || character.discord_id !== interaction.user.id) {
      await interaction.reply({ embeds: [errorEmbed('Error', 'Personaje no valido.')], ephemeral: true });
      return;
    }

    const db = getDb();
    const group = db.prepare('SELECT * FROM mplus_groups WHERE id = ?').get(groupId) as MplusGroup | undefined;
    if (!group) {
      await interaction.reply({ content: 'Grupo no encontrado.', ephemeral: true });
      return;
    }

    if (group.status === 'closed') {
      await interaction.reply({ content: 'Este grupo ya esta cerrado.', ephemeral: true });
      return;
    }

    if (group.min_ilvl > 0 && character.ilvl < group.min_ilvl) {
      await interaction.reply({
        embeds: [errorEmbed(
          'iLvl Insuficiente',
          `**${character.wow_character}** tiene **${character.ilvl}** ilvl. Este grupo requiere minimo **${group.min_ilvl}**.\nUsa \`/actualizar\` si subiste de ilvl.`,
        )],
        ephemeral: true,
      });
      return;
    }

    const signups = db.prepare('SELECT * FROM mplus_signups WHERE group_id = ?').all(groupId) as MplusSignup[];
    const already = signups.find((s) => s.discord_id === interaction.user.id);

    if (already) {
      db.prepare('UPDATE mplus_signups SET role = ?, wow_class = ?, wow_spec = ?, ilvl = ?, character_id = ? WHERE group_id = ? AND discord_id = ?')
        .run(roleName, character.wow_class, character.wow_spec, character.ilvl, character.id, groupId, interaction.user.id);
    } else {
      const tanksCount = signups.filter((s) => s.role === 'Tank').length;
      const healersCount = signups.filter((s) => s.role === 'Healer').length;
      const dpsCount = signups.filter((s) => s.role === 'DPS').length;

      if (roleName === 'Tank' && tanksCount >= 1) {
        await interaction.reply({ content: 'Ya hay un tank en el grupo.', ephemeral: true });
        return;
      }
      if (roleName === 'Healer' && healersCount >= 1) {
        await interaction.reply({ content: 'Ya hay un healer en el grupo.', ephemeral: true });
        return;
      }
      if (roleName === 'DPS' && dpsCount >= 3) {
        await interaction.reply({ content: 'Ya hay 3 DPS en el grupo.', ephemeral: true });
        return;
      }

      db.prepare('INSERT INTO mplus_signups (group_id, discord_id, role, wow_class, wow_spec, ilvl, character_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(groupId, interaction.user.id, roleName, character.wow_class, character.wow_spec, character.ilvl, character.id);
    }

    await interaction.reply({
      content: `Te uniste como **${roleName}** con **${character.wow_character}** (${character.wow_class} ${character.wow_spec} - ${character.ilvl} ilvl).`,
      ephemeral: true,
    });

    const updatedSignups = db.prepare('SELECT * FROM mplus_signups WHERE group_id = ?').all(groupId) as MplusSignup[];

    const tank = updatedSignups.find((s) => s.role === 'Tank');
    const healer = updatedSignups.find((s) => s.role === 'Healer');
    const dps = updatedSignups.filter((s) => s.role === 'DPS');
    if (tank && healer && dps.length >= 3) {
      db.prepare("UPDATE mplus_groups SET status = 'full' WHERE id = ?").run(groupId);
    }

    try {
      const channel = interaction.guild?.channels.cache.get(group.channel_id ?? '');
      if (channel?.isTextBased() && group.message_id) {
        const msg = await channel.messages.fetch(group.message_id);
        await msg.edit({ embeds: [rebuildMplusEmbed(group, updatedSignups)] });
      }
    } catch { /* message may not exist */ }
  },
};

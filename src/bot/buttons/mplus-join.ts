import {
  type ButtonInteraction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { getDb } from '../../db/database.js';
import { errorEmbed } from '../../utils/embeds.js';
import { getCharacters, type CharacterRow } from '../commands/vincular.js';
import { rebuildMplusEmbed, type MplusSignup, type MplusGroup } from '../selectmenus/char-select-mplus.js';

export default {
  customId: 'mplus_',
  async execute(interaction: ButtonInteraction) {
    const id = interaction.customId;
    const db = getDb();

    const leaveMatch = id.match(/^mplus_leave_(\d+)$/);
    if (leaveMatch) {
      const groupId = parseInt(leaveMatch[1], 10);
      const group = db.prepare('SELECT * FROM mplus_groups WHERE id = ?').get(groupId) as MplusGroup | undefined;
      if (!group) {
        await interaction.reply({ content: 'Grupo no encontrado.', ephemeral: true });
        return;
      }

      db.prepare('DELETE FROM mplus_signups WHERE group_id = ? AND discord_id = ?')
        .run(groupId, interaction.user.id);

      const signups = db.prepare('SELECT * FROM mplus_signups WHERE group_id = ?').all(groupId) as MplusSignup[];
      try { await interaction.message.edit({ embeds: [rebuildMplusEmbed(group, signups)] }); } catch { /* message may not exist */ }
      await interaction.reply({ content: 'Saliste del grupo.', ephemeral: true });
      return;
    }

    const joinMatch = id.match(/^mplus_join_(tank|healer|dps)_(\d+)$/i);
    if (!joinMatch) return;

    const [, role, groupIdStr] = joinMatch;
    const normalizedRole = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
    const roleName = normalizedRole === 'Dps' ? 'DPS' : normalizedRole;
    const groupId = parseInt(groupIdStr, 10);

    const group = db.prepare('SELECT * FROM mplus_groups WHERE id = ?').get(groupId) as MplusGroup | undefined;
    if (!group) {
      await interaction.reply({ content: 'Grupo no encontrado.', ephemeral: true });
      return;
    }

    if (group.status === 'closed') {
      await interaction.reply({ content: 'Este grupo ya esta cerrado.', ephemeral: true });
      return;
    }

    const chars = getCharacters(interaction.user.id);
    if (chars.length === 0) {
      await interaction.reply({
        embeds: [errorEmbed('Sin personajes', 'Vincula un personaje con `/vincular nombre realm` para unirte.')],
        ephemeral: true,
      });
      return;
    }

    if (chars.length === 1) {
      const character = chars[0];
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

      await doJoin(interaction, db, group, roleName, character);
    } else {
      const selectMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`charsel_mplus_${roleName}_${groupId}`)
          .setPlaceholder('Elige con que personaje...')
          .addOptions(
            chars.map((c) => ({
              label: `${c.wow_character}-${c.wow_realm}`,
              description: `${c.wow_class ?? '?'} ${c.wow_spec ?? '?'} - ${c.ilvl} ilvl${c.is_main ? ' (Main)' : ''}`,
              value: String(c.id),
            })),
          ),
      );

      await interaction.reply({
        content: `Tienes ${chars.length} personajes. Elige con cual te unes como **${roleName}**:`,
        components: [selectMenu],
        ephemeral: true,
      });
    }
  },
};

async function doJoin(
  interaction: ButtonInteraction,
  db: ReturnType<typeof getDb>,
  group: MplusGroup,
  roleName: string,
  character: CharacterRow,
): Promise<void> {
  const signups = db.prepare('SELECT * FROM mplus_signups WHERE group_id = ?').all(group.id) as MplusSignup[];
  const already = signups.find((s) => s.discord_id === interaction.user.id);

  if (already) {
    db.prepare('UPDATE mplus_signups SET role = ?, wow_class = ?, wow_spec = ?, ilvl = ?, character_id = ? WHERE group_id = ? AND discord_id = ?')
      .run(roleName, character.wow_class, character.wow_spec, character.ilvl, character.id, group.id, interaction.user.id);
    await interaction.reply({ content: `Cambiaste tu rol a **${roleName}** con **${character.wow_character}**.`, ephemeral: true });
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
      .run(group.id, interaction.user.id, roleName, character.wow_class, character.wow_spec, character.ilvl, character.id);
    await interaction.reply({ content: `Te uniste como **${roleName}** con **${character.wow_character}** (${character.wow_class} ${character.wow_spec} - ${character.ilvl} ilvl).`, ephemeral: true });
  }

  const updatedSignups = db.prepare('SELECT * FROM mplus_signups WHERE group_id = ?').all(group.id) as MplusSignup[];
  const tank = updatedSignups.find((s) => s.role === 'Tank');
  const healer = updatedSignups.find((s) => s.role === 'Healer');
  const dps = updatedSignups.filter((s) => s.role === 'DPS');
  if (tank && healer && dps.length >= 3) {
    db.prepare("UPDATE mplus_groups SET status = 'full' WHERE id = ?").run(group.id);
  }

  try { await interaction.message.edit({ embeds: [rebuildMplusEmbed(group, updatedSignups)] }); } catch { /* message may not exist */ }
}

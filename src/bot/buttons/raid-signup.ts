import {
  type ButtonInteraction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { getDb } from '../../db/database.js';
import { errorEmbed } from '../../utils/embeds.js';
import { getCharacters, getMainCharacter, formatCharacterLabel, type CharacterRow } from '../commands/vincular.js';
import { rebuildRaidEmbed, type RaidSignup, type Raid } from '../selectmenus/char-select-raid.js';

function completeRaidSignup(
  db: ReturnType<typeof getDb>,
  raidId: number,
  discordId: string,
  role: string,
  character: CharacterRow,
): string {
  const existing = db.prepare(
    'SELECT * FROM raid_signups WHERE raid_id = ? AND discord_id = ?',
  ).get(raidId, discordId) as RaidSignup | undefined;

  if (existing && existing.role === role) {
    db.prepare('DELETE FROM raid_signups WHERE raid_id = ? AND discord_id = ?')
      .run(raidId, discordId);
    return `Te removiste del raid como **${role}**.`;
  } else if (existing) {
    db.prepare('UPDATE raid_signups SET role = ?, status = ?, wow_class = ?, wow_spec = ?, ilvl = ?, character_id = ? WHERE raid_id = ? AND discord_id = ?')
      .run(role, 'confirmed', character.wow_class, character.wow_spec, character.ilvl, character.id, raidId, discordId);
    return `Cambiaste tu rol a **${role}** con **${character.wow_character}**.`;
  } else {
    db.prepare('INSERT INTO raid_signups (raid_id, discord_id, role, status, wow_class, wow_spec, ilvl, character_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(raidId, discordId, role, 'confirmed', character.wow_class, character.wow_spec, character.ilvl, character.id);
    return `Te apuntaste como **${role}** con **${character.wow_character}** (${character.wow_class} ${character.wow_spec} - ${character.ilvl} ilvl).`;
  }
}

export default {
  customId: 'raid_signup_',
  async execute(interaction: ButtonInteraction) {
    const match = interaction.customId.match(/^raid_signup_(tank|healer|dps|tentative|absent)_(\d+)$/);
    if (!match) return;

    const [, role, raidIdStr] = match;
    const raidId = parseInt(raidIdStr, 10);
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

    const isGameRole = role === 'tank' || role === 'healer' || role === 'dps';

    if (isGameRole) {
      const chars = getCharacters(interaction.user.id);
      if (chars.length === 0) {
        await interaction.reply({
          embeds: [errorEmbed('Sin personajes', 'Vincula un personaje con `/vincular nombre realm` para anotarte.')],
          ephemeral: true,
        });
        return;
      }

      if (chars.length === 1) {
        const character = chars[0];
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

        const msg = completeRaidSignup(db, raidId, interaction.user.id, role, character);
        await interaction.reply({ content: msg, ephemeral: true });
      } else {
        const selectMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`charsel_raid_${role}_${raidId}`)
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
          content: `Tienes ${chars.length} personajes. Elige con cual te anotas como **${role}**:`,
          components: [selectMenu],
          ephemeral: true,
        });
        return;
      }
    } else {
      const existing = db.prepare(
        'SELECT * FROM raid_signups WHERE raid_id = ? AND discord_id = ?',
      ).get(raidId, interaction.user.id) as RaidSignup | undefined;

      if (existing && existing.role === role) {
        db.prepare('DELETE FROM raid_signups WHERE raid_id = ? AND discord_id = ?')
          .run(raidId, interaction.user.id);
        await interaction.reply({ content: `Te removiste como **${role}**.`, ephemeral: true });
      } else if (existing) {
        db.prepare('UPDATE raid_signups SET role = ?, status = ? WHERE raid_id = ? AND discord_id = ?')
          .run(role, role, raidId, interaction.user.id);
        await interaction.reply({ content: `Cambiaste tu estado a **${role}**.`, ephemeral: true });
      } else {
        db.prepare('INSERT INTO raid_signups (raid_id, discord_id, role, status) VALUES (?, ?, ?, ?)')
          .run(raidId, interaction.user.id, role, role);
        await interaction.reply({ content: `Marcaste como **${role}**.`, ephemeral: true });
      }
    }

    const signups = db.prepare('SELECT * FROM raid_signups WHERE raid_id = ?')
      .all(raidId) as RaidSignup[];
    const newEmbed = rebuildRaidEmbed(raid, signups);
    try { await interaction.message.edit({ embeds: [newEmbed] }); } catch { /* message may not exist */ }
  },
};

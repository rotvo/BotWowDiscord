import { type StringSelectMenuInteraction } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { getCharacterById } from '../commands/vincular.js';
import {
  addCoreMember,
  getCoreMember,
  refreshCoreMessage,
  notifyAdminCoreSignup,
} from '../../utils/core-embed.js';

export default {
  customId: 'charsel_core_',
  async execute(interaction: StringSelectMenuInteraction) {
    const role = interaction.customId.replace('charsel_core_', '');
    const charId = parseInt(interaction.values[0], 10);

    const character = getCharacterById(charId);
    if (!character || character.discord_id !== interaction.user.id) {
      await interaction.reply({
        embeds: [errorEmbed('Error', 'Personaje no válido.')],
        ephemeral: true,
      });
      return;
    }

    const existing = getCoreMember(interaction.user.id);
    const isFirstTime = !existing;

    addCoreMember(interaction.user.id, character.id, role);

    const action = existing ? 'Actualizado' : 'Inscrito';
    const entrevistaMsg = isFirstTime
      ? '\n\nUn oficial te contactará para tu entrevista.'
      : '';

    await interaction.reply({
      embeds: [successEmbed(
        `✅ ${action} en el Core`,
        `Te inscribiste como **${role}** con **${character.wow_character}** (${character.wow_class} ${character.wow_spec} — ${character.ilvl} ilvl).${entrevistaMsg}`,
      )],
      ephemeral: true,
    });

    if (isFirstTime) {
      await notifyAdminCoreSignup(
        interaction.client,
        interaction.user.id,
        interaction.user.displayName,
        role,
        `${character.wow_character} (${character.wow_class} ${character.wow_spec} — ${character.ilvl} ilvl)`,
      );
    }

    if (interaction.guild) {
      await refreshCoreMessage(interaction.guild);
    }
  },
};

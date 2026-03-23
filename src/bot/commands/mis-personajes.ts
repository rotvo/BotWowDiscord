import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
  type ButtonInteraction,
  ComponentType,
} from 'discord.js';
import { WOW_CLASS_COLORS } from '../../utils/constants.js';
import { errorEmbed, wowEmbed } from '../../utils/embeds.js';
import {
  getCharacters,
  setMainCharacter,
  deleteCharacter,
  formatCharacterLabel,
  type CharacterRow,
} from './vincular.js';

function buildEmbed(chars: CharacterRow[]): EmbedBuilder {
  const lines = chars.map((c, i) => {
    const mainTag = c.is_main ? ' **[MAIN]**' : '';
    const color = WOW_CLASS_COLORS[c.wow_class ?? ''] ? '' : '';
    return `${i + 1}. **${c.wow_character}** - ${c.wow_realm}${mainTag}\n` +
      `   ${c.wow_class ?? '?'} ${c.wow_spec ?? '?'} | ${c.ilvl} ilvl | M+ ${c.rio_score ?? 0}`;
  });

  return wowEmbed('Mis Personajes', lines.join('\n\n') || 'No tienes personajes vinculados.');
}

export default {
  data: new SlashCommandBuilder()
    .setName('mis-personajes')
    .setDescription('Lista, cambia main o desvincula tus personajes de WoW'),
  async execute(interaction: ChatInputCommandInteraction) {
    const chars = getCharacters(interaction.user.id);

    if (chars.length === 0) {
      await interaction.reply({
        embeds: [errorEmbed('Sin Personajes', 'No tienes personajes vinculados.\nUsa `/vincular nombre realm` para agregar uno.')],
        ephemeral: true,
      });
      return;
    }

    const embed = buildEmbed(chars);

    const components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [];

    if (chars.length > 1) {
      const mainSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('mispj_setmain')
          .setPlaceholder('Cambiar personaje principal...')
          .addOptions(
            chars.map((c) => ({
              label: `${c.wow_character}-${c.wow_realm}`,
              description: `${c.wow_class ?? '?'} ${c.wow_spec ?? '?'} - ${c.ilvl} ilvl${c.is_main ? ' (actual main)' : ''}`,
              value: String(c.id),
            })),
          ),
      );
      components.push(mainSelect);
    }

    const removeSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('mispj_remove')
        .setPlaceholder('Desvincular personaje...')
        .addOptions(
          chars.map((c) => ({
            label: `${c.wow_character}-${c.wow_realm}`,
            description: `${c.wow_class ?? '?'} ${c.wow_spec ?? '?'} - ${c.ilvl} ilvl`,
            value: String(c.id),
          })),
        ),
    );
    components.push(removeSelect);

    const msg = await interaction.reply({
      embeds: [embed],
      components,
      ephemeral: true,
    });

    const collector = msg.createMessageComponentCollector({
      time: 60_000,
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) return;

      if (i.isStringSelectMenu() && i.customId === 'mispj_setmain') {
        const charId = parseInt(i.values[0], 10);
        setMainCharacter(interaction.user.id, charId);
        const updated = getCharacters(interaction.user.id);
        const target = updated.find((c) => c.id === charId);
        await i.update({
          embeds: [buildEmbed(updated)],
          content: target ? `**${target.wow_character}** es ahora tu main.` : undefined,
        });
      } else if (i.isStringSelectMenu() && i.customId === 'mispj_remove') {
        const charId = parseInt(i.values[0], 10);
        const target = chars.find((c) => c.id === charId);
        const removed = deleteCharacter(charId, interaction.user.id);
        const updated = getCharacters(interaction.user.id);

        if (removed && target) {
          if (updated.length === 0) {
            await i.update({
              embeds: [wowEmbed('Mis Personajes', `**${target.wow_character}** desvinculado. Ya no tienes personajes.`)],
              components: [],
            });
          } else {
            await i.update({
              embeds: [buildEmbed(updated)],
              content: `**${target.wow_character}** desvinculado.`,
            });
          }
        } else {
          await i.update({ content: 'No se pudo desvincular.', embeds: [buildEmbed(updated)] });
        }
      }
    });

    collector.on('end', async () => {
      try {
        await interaction.editReply({ components: [] });
      } catch { /* expired */ }
    });
  },
};

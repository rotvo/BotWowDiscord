import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { fetchCurrentAffixes } from '../../api/raiderio.js';
import { config } from '../../config.js';
import { EMBED_COLORS } from '../../utils/constants.js';

export default {
  data: new SlashCommandBuilder()
    .setName('afijos')
    .setDescription('Muestra los afijos de M+ de esta semana'),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const data = await fetchCurrentAffixes(config.guild.region);

    if (!data) {
      await interaction.editReply('No se pudieron obtener los afijos. Intenta de nuevo mas tarde.');
      return;
    }

    const affixLines = data.affix_details.map((a) =>
      `**${a.name}**\n${a.description}`,
    );

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.wow)
      .setTitle(`Afijos de la Semana`)
      .setDescription(data.title)
      .addFields(
        data.affix_details.map((a) => ({
          name: a.name,
          value: a.description || 'Sin descripcion',
          inline: false,
        })),
      )
      .setFooter({ text: 'Datos de Raider.IO' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

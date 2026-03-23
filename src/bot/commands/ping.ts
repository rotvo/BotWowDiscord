import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Verifica la latencia del bot'),
  async execute(interaction: ChatInputCommandInteraction) {
    const sent = await interaction.reply({
      content: 'Calculando...',
      fetchReply: true,
    });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const wsLatency = interaction.client.ws.ping;

    const embed = successEmbed(
      'Pong!',
      `**Latencia:** ${latency}ms\n**API:** ${wsLatency}ms`,
    );

    await interaction.editReply({ content: '', embeds: [embed] });
  },
};

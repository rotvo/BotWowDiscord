import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { fetchLatestVideos } from '../../api/youtube.js';
import { config } from '../../config.js';
import { errorEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('youtube')
    .setDescription('Muestra los videos mas recientes del canal de YouTube')
    .addIntegerOption((opt) =>
      opt.setName('cantidad')
        .setDescription('Cantidad de videos a mostrar (max 5)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(5),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const { apiKey, channelId } = config.youtube;
    if (!apiKey || !channelId) {
      await interaction.reply({
        embeds: [errorEmbed('No configurado', 'Faltan YOUTUBE_API_KEY y YOUTUBE_CHANNEL_ID en el .env')],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const cantidad = interaction.options.getInteger('cantidad') ?? 3;
    const videos = await fetchLatestVideos(channelId, apiKey, cantidad);

    if (videos.length === 0) {
      await interaction.editReply('No se encontraron videos.');
      return;
    }

    const embeds = videos.map((v) =>
      new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle(v.title)
        .setURL(v.url)
        .setDescription(v.description.slice(0, 200) + (v.description.length > 200 ? '...' : ''))
        .setImage(v.thumbnailUrl)
        .setFooter({ text: v.channelTitle })
        .setTimestamp(new Date(v.publishedAt)),
    );

    const ytChannel = interaction.guild?.channels.cache.find(
      (c) => c.name === 'youtube-videos' && c.type === ChannelType.GuildText,
    );

    if (ytChannel && ytChannel.isTextBased()) {
      await ytChannel.send({ embeds: embeds.slice(0, 1) });
    }

    await interaction.editReply({ embeds });
  },
};

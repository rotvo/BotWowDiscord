import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { checkIfLive, fetchUserInfo } from '../../api/twitch.js';
import { config } from '../../config.js';
import { errorEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('stream')
    .setDescription('Anuncia un stream de Twitch')
    .addStringOption((opt) =>
      opt.setName('canal')
        .setDescription('Nombre del canal de Twitch (por defecto usa el configurado)')
        .setRequired(false),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const { clientId, clientSecret } = config.twitch;
    if (!clientId || !clientSecret) {
      await interaction.reply({
        embeds: [errorEmbed('No configurado', 'Faltan TWITCH_CLIENT_ID y TWITCH_CLIENT_SECRET en el .env')],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const canal = interaction.options.getString('canal') ?? config.twitch.channel;
    if (!canal) {
      await interaction.editReply({ embeds: [errorEmbed('Error', 'Especifica un canal o configura TWITCH_CHANNEL en el .env')] });
      return;
    }

    const stream = await checkIfLive(canal, clientId, clientSecret);
    const userInfo = await fetchUserInfo(canal, clientId, clientSecret);

    const liveChannel = interaction.guild?.channels.cache.find(
      (c) => c.name === 'twitch-live' && c.type === ChannelType.GuildText,
    );

    if (stream) {
      const thumb = stream.thumbnail_url
        .replace('{width}', '1280')
        .replace('{height}', '720');

      const embed = new EmbedBuilder()
        .setColor(0x9146FF)
        .setTitle(`${stream.user_name} esta EN VIVO!`)
        .setURL(`https://twitch.tv/${canal}`)
        .setDescription(stream.title)
        .addFields(
          { name: 'Jugando', value: stream.game_name || 'N/A', inline: true },
          { name: 'Viewers', value: `${stream.viewer_count}`, inline: true },
        )
        .setImage(thumb + `?t=${Date.now()}`)
        .setTimestamp(new Date(stream.started_at));

      if (userInfo?.profile_image_url) {
        embed.setThumbnail(userInfo.profile_image_url);
      }

      if (liveChannel && liveChannel.isTextBased()) {
        await liveChannel.send({ content: '@everyone', embeds: [embed] });
      }

      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.editReply(`**${canal}** no esta en vivo ahora mismo.`);
    }
  },
};

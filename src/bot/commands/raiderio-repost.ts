import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type Message,
  type TextChannel,
  type Guild,
} from 'discord.js';
import { config } from '../../config.js';
import {
  extractCharacterNamesFromEmbeds,
  getDiscordIdsForCharacterNames,
  parseRaiderIORunEmbed,
  buildCustomRunEmbed,
  buildRunMentionPrefix,
} from '../../utils/raiderio-embed.js';
import type { EmbedBuilder, Embed } from 'discord.js';

const norm = (s: string) => s.toLowerCase().replace(/^[-]+|[-]+$/g, '').trim();

function channelNameMatches(chanName: string, configName: string): boolean {
  const n = norm(chanName);
  const c = norm(configName);
  return n === c || n.endsWith(c) || n.endsWith('-' + c);
}

async function getRaiderioChannels(guild: Guild) {
  const { sourceChannel: sourceName, targetChannel: targetName } = config.raiderio;
  if (!sourceName || !targetName) return null;
  await guild.channels.fetch();
  const source = guild.channels.cache.find((c) => channelNameMatches(c.name, sourceName));
  const target = guild.channels.cache.find((c) => channelNameMatches(c.name, targetName));
  if (!source || !target?.isTextBased() || target.isDMBased()) return null;
  return { source: source as TextChannel, target: target as TextChannel };
}

function buildRepostContent(message: Message, guild: Guild): {
  content: string | undefined;
  embeds: EmbedBuilder[] | Embed[];
  files: Message['attachments'];
} {
  const { mentionRoleName } = config.raiderio;
  let roleMention: string | null = null;
  if (mentionRoleName) {
    const role = guild.roles.cache.find(
      (r) => r.name === mentionRoleName || r.name.toLowerCase() === mentionRoleName.toLowerCase(),
    );
    if (role) roleMention = role.toString();
  }
  const characterNames = extractCharacterNamesFromEmbeds([...message.embeds]);
  const discordIds = getDiscordIdsForCharacterNames(characterNames);
  const prefix = buildRunMentionPrefix(roleMention, discordIds);

  const parsed = parseRaiderIORunEmbed([...message.embeds]);
  if (parsed) {
    const customEmbed = buildCustomRunEmbed(parsed);
    return {
      content: prefix.trim() || undefined,
      embeds: [customEmbed],
      files: message.attachments,
    };
  }
  return {
    content: (prefix + (message.content || '').trim()).trim() || undefined,
    embeds: message.embeds,
    files: message.attachments,
  };
}

export default {
  data: new SlashCommandBuilder()
    .setName('raiderio-repost')
    .setDescription('Republica el último mensaje de Raider.IO del canal de auditoría al canal público.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.guild || interaction.guild.id !== config.discord.guildId) {
      await interaction.editReply('Este comando solo está disponible en el servidor configurado.');
      return;
    }

    const channels = await getRaiderioChannels(interaction.guild);
    if (!channels) {
      const src = process.env.RAIDERIO_SOURCE_CHANNEL;
      const tgt = process.env.RAIDERIO_TARGET_CHANNEL;
      console.warn('[RaiderIO repost] No configurado. cwd=%s RAIDERIO_SOURCE_CHANNEL=%s RAIDERIO_TARGET_CHANNEL=%s', process.cwd(), src ?? '(no definido)', tgt ?? '(no definido)');
      await interaction.editReply(
        'Raider.IO repost no está configurado (revisa RAIDERIO_SOURCE_CHANNEL y RAIDERIO_TARGET_CHANNEL en .env). Ejecuta el bot desde la carpeta del proyecto (donde está el .env).',
      );
      return;
    }

    const messages = await channels.source.messages.fetch({ limit: 20 });
    const lastFromBot = messages.find((m) => m.webhookId != null || m.author?.bot === true);
    if (!lastFromBot) {
      await interaction.editReply('No hay ningún mensaje de Raider.IO (bot/webhook) en el canal de auditoría.');
      return;
    }

    const { content, embeds, files } = buildRepostContent(lastFromBot, interaction.guild);
    try {
      await channels.target.send({
        content: content ?? undefined,
        embeds: embeds.length > 0 ? embeds : undefined,
        files: files.size > 0 ? [...files.values()] : undefined,
      });
      await interaction.editReply(`Listo, reposteado a **#${channels.target.name}**.`);
    } catch (err) {
      console.error('[RaiderIO repost]', err);
      await interaction.editReply('No se pudo enviar al canal destino. Revisa permisos del bot.');
    }
  },
};

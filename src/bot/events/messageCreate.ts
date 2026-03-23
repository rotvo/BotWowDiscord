import { Events, type Message, type TextChannel } from 'discord.js';
import { config } from '../../config.js';
import {
  extractCharacterNamesFromEmbeds,
  getDiscordIdsForCharacterNames,
  parseRaiderIORunEmbed,
  buildCustomRunEmbed,
  buildRunMentionPrefix,
} from '../../utils/raiderio-embed.js';

export default {
  name: Events.MessageCreate,
  once: false,
  async execute(message: Message) {
    const { sourceChannel: sourceName, targetChannel: targetName, mentionRoleName } = config.raiderio;
    if (!sourceName || !targetName || !message.guild || message.guild.id !== config.discord.guildId) return;

    const guild = message.guild;
    const norm = (s: string) => s.toLowerCase().replace(/^[-]+|[-]+$/g, '').trim();
    const matches = (chanName: string, configName: string) => {
      const n = norm(chanName);
      const c = norm(configName);
      return n === c || n.endsWith(c) || n.endsWith('-' + c);
    };
    const sourceChannel = guild.channels.cache.find((c) => matches(c.name, sourceName));
    const targetChannel = guild.channels.cache.find((c) => matches(c.name, targetName));

    if (!sourceChannel || !targetChannel) {
      const currentName = (message.channel as { name?: string }).name ?? '';
      if (message.channelId && matches(currentName, sourceName)) {
        console.warn('[RaiderIO repost] Canal destino no encontrado. Revisa RAIDERIO_TARGET_CHANNEL.');
      }
      return;
    }
    if (sourceChannel.id !== message.channelId) return;
    if (!targetChannel.isTextBased() || targetChannel.isDMBased()) return;

    const isFromRaiderIO = message.webhookId != null || (message.author?.bot === true);
    if (!isFromRaiderIO) return;

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
    let content: string | undefined;
    let embeds: Message['embeds'] | import('discord.js').EmbedBuilder[];
    if (parsed) {
      content = prefix.trim() || undefined;
      embeds = [buildCustomRunEmbed(parsed)];
    } else {
      content = (prefix + (message.content || '').trim()).trim() || undefined;
      embeds = message.embeds;
    }

    try {
      await (targetChannel as TextChannel).send({
        content: content || undefined,
        embeds: embeds.length > 0 ? embeds : undefined,
        files: message.attachments.size > 0 ? [...message.attachments.values()] : undefined,
      });
      await message.delete().catch(() => {});
    } catch (err) {
      console.error('[RaiderIO repost]', err);
    }
  },
};

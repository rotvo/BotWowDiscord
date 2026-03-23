import { Events, EmbedBuilder, AuditLogEvent, type GuildMember, type PartialGuildMember } from 'discord.js';
import { findChannelByName } from '../../utils/channels.js';

export default {
  name: Events.GuildMemberRemove,
  once: false,
  async execute(member: GuildMember | PartialGuildMember) {
    const logChannel = findChannelByName(member.guild, 'log-moderacion');
    if (!logChannel?.isTextBased()) return;

    const roles = member.roles?.cache
      .filter((r) => r.id !== member.guild.id)
      .map((r) => r.name)
      .join(', ') || 'Ninguno';

    const joinedAt = member.joinedTimestamp
      ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
      : 'Desconocido';

    let kickedBy: string | null = null;
    try {
      const auditLogs = await member.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberKick,
        limit: 5,
      });
      const kickLog = auditLogs.entries.find(
        (entry) =>
          entry.target?.id === member.id &&
          Date.now() - entry.createdTimestamp < 10000,
      );
      if (kickLog?.executor) {
        kickedBy = `${kickLog.executor} (${kickLog.executor.tag})`;
      }
    } catch {
      // May not have audit log permission
    }

    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle(kickedBy ? 'Miembro Kickeado' : 'Miembro Salio')
      .setDescription(`**${member.user?.tag ?? 'Desconocido'}** (${member})`)
      .addFields(
        { name: 'ID', value: member.id, inline: true },
        { name: 'Se unio', value: joinedAt, inline: true },
        { name: 'Miembros restantes', value: `${member.guild.memberCount}`, inline: true },
        { name: 'Roles que tenia', value: roles.length > 1024 ? roles.slice(0, 1020) + '...' : roles },
      )
      .setThumbnail(member.user?.displayAvatarURL({ size: 64 }) ?? null)
      .setTimestamp();

    if (kickedBy) {
      embed.addFields({ name: 'Kickeado por', value: kickedBy });
    }

    await logChannel.send({ embeds: [embed] });
  },
};

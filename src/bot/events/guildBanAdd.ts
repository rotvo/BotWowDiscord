import { Events, EmbedBuilder, AuditLogEvent, type GuildBan } from 'discord.js';
import { findChannelByName } from '../../utils/channels.js';

export default {
  name: Events.GuildBanAdd,
  once: false,
  async execute(ban: GuildBan) {
    const logChannel = findChannelByName(ban.guild, 'log-moderacion');
    if (!logChannel?.isTextBased()) return;

    let bannedBy = 'Desconocido';
    let reason = ban.reason ?? 'Sin razon especificada';

    try {
      const auditLogs = await ban.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberBanAdd,
        limit: 5,
      });
      const banLog = auditLogs.entries.find(
        (entry) =>
          entry.target?.id === ban.user.id &&
          Date.now() - entry.createdTimestamp < 10000,
      );
      if (banLog?.executor) {
        bannedBy = `${banLog.executor} (${banLog.executor.tag})`;
      }
      if (banLog?.reason) {
        reason = banLog.reason;
      }
    } catch {
      // May not have audit log permission
    }

    const embed = new EmbedBuilder()
      .setColor(0x992D22)
      .setTitle('Miembro Baneado')
      .setDescription(`**${ban.user.tag}** (<@${ban.user.id}>)`)
      .addFields(
        { name: 'ID', value: ban.user.id, inline: true },
        { name: 'Baneado por', value: bannedBy, inline: true },
        { name: 'Razon', value: reason },
      )
      .setThumbnail(ban.user.displayAvatarURL({ size: 64 }))
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  },
};

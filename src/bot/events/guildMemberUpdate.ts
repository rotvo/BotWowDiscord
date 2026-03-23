import { Events, EmbedBuilder, type GuildMember, type PartialGuildMember } from 'discord.js';
import { findChannelByName } from '../../utils/channels.js';

export default {
  name: Events.GuildMemberUpdate,
  once: false,
  async execute(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
    const logChannel = findChannelByName(newMember.guild, 'log-moderacion');
    if (!logChannel?.isTextBased()) return;

    const oldRoles = oldMember.roles?.cache;
    const newRoles = newMember.roles.cache;
    if (!oldRoles) return;

    const addedRoles = newRoles.filter((r) => !oldRoles.has(r.id));
    const removedRoles = oldRoles.filter((r) => !newRoles.has(r.id));

    if (addedRoles.size === 0 && removedRoles.size === 0) return;

    const fields: { name: string; value: string; inline?: boolean }[] = [];

    if (addedRoles.size > 0) {
      fields.push({
        name: 'Roles agregados',
        value: addedRoles.map((r) => r.name).join(', '),
      });
    }

    if (removedRoles.size > 0) {
      fields.push({
        name: 'Roles removidos',
        value: removedRoles.map((r) => r.name).join(', '),
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle('Cambio de Roles')
      .setDescription(`${newMember} (${newMember.user.tag})`)
      .addFields(fields)
      .setThumbnail(newMember.user.displayAvatarURL({ size: 64 }))
      .setFooter({ text: `ID: ${newMember.id}` })
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  },
};

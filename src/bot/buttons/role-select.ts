import type { ButtonInteraction, GuildMember, Role } from 'discord.js';
import { WOW_CLASSES, ROLE_TYPES, ACTIVITY_TYPES } from '../../utils/constants.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

function findRole(member: GuildMember, name: string): Role | undefined {
  return member.guild.roles.cache.find((r) => r.name === name);
}

async function toggleRole(interaction: ButtonInteraction, roleName: string, groupNames?: readonly string[]): Promise<void> {
  const member = interaction.member as GuildMember;
  const role = findRole(member, roleName);

  if (!role) {
    await interaction.reply({ embeds: [errorEmbed('Error', `Rol "${roleName}" no encontrado.`)], ephemeral: true });
    return;
  }

  if (member.roles.cache.has(role.id)) {
    await member.roles.remove(role);
    await interaction.reply({
      embeds: [successEmbed('Rol Removido', `Se removio el rol **${roleName}**.`)],
      ephemeral: true,
    });
    return;
  }

  if (groupNames) {
    const toRemove = member.roles.cache.filter((r) => groupNames.includes(r.name) && r.id !== role.id);
    if (toRemove.size > 0) {
      await member.roles.remove(toRemove);
    }
  }

  await member.roles.add(role);
  await interaction.reply({
    embeds: [successEmbed('Rol Asignado', `Ahora tienes el rol **${roleName}**.`)],
    ephemeral: true,
  });
}

export default {
  customId: 'role_',
  async execute(interaction: ButtonInteraction) {
    const id = interaction.customId;

    if (id.startsWith('role_class_')) {
      const className = id.replace('role_class_', '');
      await toggleRole(interaction, className, WOW_CLASSES);
    } else if (id.startsWith('role_type_')) {
      const typeName = id.replace('role_type_', '');
      await toggleRole(interaction, typeName, ROLE_TYPES);
    } else if (id.startsWith('role_activity_')) {
      const actName = id.replace('role_activity_', '');
      await toggleRole(interaction, actName);
    } else if (id.startsWith('role_prof_')) {
      const profName = id.replace('role_prof_', '');
      await toggleRole(interaction, profName);
    }
  },
};

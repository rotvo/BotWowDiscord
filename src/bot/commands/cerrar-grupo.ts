import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { getDb } from '../../db/database.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('cerrar-grupo')
    .setDescription('Cierra un grupo de M+')
    .addIntegerOption((opt) =>
      opt.setName('id').setDescription('ID del grupo a cerrar').setRequired(true),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const groupId = interaction.options.getInteger('id', true);
    const db = getDb();

    const group = db.prepare('SELECT * FROM mplus_groups WHERE id = ?').get(groupId) as {
      id: number;
      leader_id: string;
      dungeon: string;
      key_level: number;
      status: string;
      message_id: string | null;
      channel_id: string | null;
    } | undefined;

    if (!group) {
      await interaction.reply({ embeds: [errorEmbed('Error', `Grupo #${groupId} no encontrado.`)], ephemeral: true });
      return;
    }

    if (group.status === 'closed') {
      await interaction.reply({ embeds: [errorEmbed('Error', `Grupo #${groupId} ya esta cerrado.`)], ephemeral: true });
      return;
    }

    const isLeader = group.leader_id === interaction.user.id;
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;

    if (!isLeader && !isAdmin) {
      await interaction.reply({ embeds: [errorEmbed('Sin Permiso', 'Solo el lider del grupo o un administrador puede cerrarlo.')], ephemeral: true });
      return;
    }

    db.prepare("UPDATE mplus_groups SET status = 'closed' WHERE id = ?").run(groupId);

    if (group.message_id && group.channel_id) {
      try {
        const channel = interaction.guild?.channels.cache.get(group.channel_id);
        if (channel?.isTextBased()) {
          const msg = await channel.messages.fetch(group.message_id);
          const closedEmbed = new EmbedBuilder()
            .setColor(0x95A5A6)
            .setTitle(`CERRADO — M+ ${group.dungeon} +${group.key_level}`)
            .setDescription(`Este grupo fue cerrado por <@${interaction.user.id}>.`)
            .setFooter({ text: `Grupo ID: ${groupId}` })
            .setTimestamp();
          await msg.edit({ embeds: [closedEmbed], components: [] });
        }
      } catch { /* message may not exist */ }
    }

    await interaction.reply({
      embeds: [successEmbed('Grupo Cerrado', `Grupo #${groupId} — **M+ ${group.dungeon} +${group.key_level}** ha sido cerrado.`)],
    });
  },
};

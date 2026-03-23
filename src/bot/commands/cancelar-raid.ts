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
    .setName('cancelar-raid')
    .setDescription('Cancela un raid programado')
    .addIntegerOption((opt) =>
      opt.setName('id').setDescription('ID del raid a cancelar').setRequired(true),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const raidId = interaction.options.getInteger('id', true);
    const db = getDb();

    const raid = db.prepare('SELECT * FROM raids WHERE id = ?').get(raidId) as {
      id: number;
      title: string;
      difficulty: string;
      created_by: string;
      status: string;
      message_id: string | null;
      channel_id: string | null;
    } | undefined;

    if (!raid) {
      await interaction.reply({ embeds: [errorEmbed('Error', `Raid #${raidId} no encontrado.`)], ephemeral: true });
      return;
    }

    if (raid.status === 'cancelled') {
      await interaction.reply({ embeds: [errorEmbed('Error', `Raid #${raidId} ya esta cancelado.`)], ephemeral: true });
      return;
    }

    const isCreator = raid.created_by === interaction.user.id;
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;

    if (!isCreator && !isAdmin) {
      await interaction.reply({ embeds: [errorEmbed('Sin Permiso', 'Solo el creador del raid o un administrador puede cancelarlo.')], ephemeral: true });
      return;
    }

    db.prepare("UPDATE raids SET status = 'cancelled' WHERE id = ?").run(raidId);

    if (raid.message_id && raid.channel_id) {
      try {
        const channel = interaction.guild?.channels.cache.get(raid.channel_id);
        if (channel?.isTextBased()) {
          const msg = await channel.messages.fetch(raid.message_id);
          const cancelledEmbed = new EmbedBuilder()
            .setColor(0x95A5A6)
            .setTitle(`CANCELADO — ${raid.title} (${raid.difficulty})`)
            .setDescription(`Este raid ha sido cancelado por <@${interaction.user.id}>.`)
            .setFooter({ text: `Raid ID: ${raidId}` })
            .setTimestamp();
          await msg.edit({ embeds: [cancelledEmbed], components: [] });
        }
      } catch { /* message may not exist */ }
    }

    await interaction.reply({
      embeds: [successEmbed('Raid Cancelado', `Raid #${raidId} — **${raid.title}** ha sido cancelado.`)],
    });
  },
};

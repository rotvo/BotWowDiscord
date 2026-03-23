import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { getDb } from '../../db/database.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('log-raid')
    .setDescription('Vincula un log de WarcraftLogs a un raid y marca asistencia')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addIntegerOption((opt) =>
      opt.setName('raid-id')
        .setDescription('ID del raid')
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName('log-url')
        .setDescription('URL del log de WarcraftLogs')
        .setRequired(true),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const raidId = interaction.options.getInteger('raid-id', true);
    const logUrl = interaction.options.getString('log-url', true);

    const db = getDb();
    const raid = db.prepare('SELECT * FROM raids WHERE id = ?').get(raidId) as { id: number } | undefined;

    if (!raid) {
      await interaction.reply({ embeds: [errorEmbed('Error', 'Raid no encontrado.')], ephemeral: true });
      return;
    }

    db.prepare("UPDATE raids SET log_url = ?, status = 'completed' WHERE id = ?")
      .run(logUrl, raidId);

    const signups = db.prepare(
      "SELECT discord_id FROM raid_signups WHERE raid_id = ? AND status = 'confirmed'",
    ).all(raidId) as { discord_id: string }[];

    const insertAttendance = db.prepare(
      'INSERT OR IGNORE INTO attendance (raid_id, discord_id, present) VALUES (?, ?, 1)',
    );

    for (const signup of signups) {
      insertAttendance.run(raidId, signup.discord_id);
    }

    await interaction.reply({
      embeds: [successEmbed(
        'Log Vinculado',
        [
          `**Raid #${raidId}** marcado como completado.`,
          `**Log:** ${logUrl}`,
          `**Asistencia registrada:** ${signups.length} jugadores`,
        ].join('\n'),
      )],
    });
  },
};

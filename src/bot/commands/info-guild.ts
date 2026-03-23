import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { wowEmbed } from '../../utils/embeds.js';
import { config } from '../../config.js';
import { getDb } from '../../db/database.js';

export default {
  data: new SlashCommandBuilder()
    .setName('info-guild')
    .setDescription('Muestra informacion general de la guild'),
  async execute(interaction: ChatInputCommandInteraction) {
    const db = getDb();
    const memberCount = db
      .prepare('SELECT COUNT(DISTINCT discord_id) as count FROM characters')
      .get() as { count: number };
    const pendingApps = db
      .prepare("SELECT COUNT(*) as count FROM applications WHERE status = 'pending'")
      .get() as { count: number };
    const upcomingRaids = db
      .prepare("SELECT COUNT(*) as count FROM raids WHERE status = 'scheduled' AND scheduled_at > datetime('now')")
      .get() as { count: number };

    const embed = wowEmbed(
      `${config.guild.name}`,
      [
        `**Servidor:** ${config.guild.realm}`,
        `**Region:** ${config.guild.region.toUpperCase()}`,
        `**Miembros vinculados:** ${memberCount.count}`,
        `**Aplicaciones pendientes:** ${pendingApps.count}`,
        `**Raids programados:** ${upcomingRaids.count}`,
        '',
        '*Usa /help para ver todos los comandos disponibles.*',
      ].join('\n'),
    ).setThumbnail('https://wow.zamimg.com/images/wow/icons/large/inv_misc_tabardpvp_04.jpg');

    await interaction.reply({ embeds: [embed] });
  },
};

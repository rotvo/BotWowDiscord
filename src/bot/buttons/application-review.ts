import {
  type ButtonInteraction,
  type GuildMember,
  EmbedBuilder,
} from 'discord.js';
import { getDb } from '../../db/database.js';
import { successEmbed, errorEmbed, infoEmbed } from '../../utils/embeds.js';

export default {
  customId: 'app_',
  async execute(interaction: ButtonInteraction) {
    const id = interaction.customId;

    const match = id.match(/^app_(accept|interview|reject)_(\d+)$/);
    if (!match) return;

    const [, action, appIdStr] = match;
    const appId = parseInt(appIdStr, 10);

    const db = getDb();
    const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId) as {
      id: number;
      discord_id: string;
      discord_name: string;
      character_name: string;
      realm: string;
      wow_class: string;
      status: string;
    } | undefined;

    if (!app) {
      await interaction.reply({ embeds: [errorEmbed('Error', 'Aplicacion no encontrada.')], ephemeral: true });
      return;
    }

    if (app.status !== 'pending') {
      await interaction.reply({
        embeds: [errorEmbed('Ya procesada', `Esta aplicacion ya fue **${app.status}**.`)],
        ephemeral: true,
      });
      return;
    }

    const reviewer = interaction.user.tag;

    if (action === 'accept') {
      db.prepare("UPDATE applications SET status = 'accepted', reviewed_by = ?, updated_at = datetime('now') WHERE id = ?")
        .run(reviewer, appId);

      db.prepare(`
        INSERT OR IGNORE INTO members (discord_id, discord_name, guild_rank)
        VALUES (?, ?, 'Trial')
      `).run(app.discord_id, app.discord_name);

      db.prepare(`
        INSERT OR IGNORE INTO characters (discord_id, wow_character, wow_realm, wow_class, is_main)
        VALUES (?, ?, ?, ?, 1)
      `).run(app.discord_id, app.character_name, app.realm, app.wow_class);

      const member = interaction.guild?.members.cache.get(app.discord_id);
      if (member) {
        const trialRole = interaction.guild?.roles.cache.find((r) => r.name === 'Trial');
        if (trialRole) await member.roles.add(trialRole);

        try {
          await member.send({
            embeds: [successEmbed(
              'Aplicacion Aceptada',
              `¡Bienvenido a la guild! Has sido aceptado como **Trial**.\nRevisa los canales del servidor y usa \`/help\` para ver los comandos disponibles.`,
            )],
          });
        } catch {
          // DMs disabled
        }
      }

      const embed = successEmbed(
        `Aplicacion #${appId} — ACEPTADA`,
        `**${app.character_name}-${app.realm}** fue aceptado por **${reviewer}**.`,
      );
      await interaction.update({ embeds: [interaction.message.embeds[0], embed], components: [] });

    } else if (action === 'reject') {
      db.prepare("UPDATE applications SET status = 'rejected', reviewed_by = ?, updated_at = datetime('now') WHERE id = ?")
        .run(reviewer, appId);

      const member = interaction.guild?.members.cache.get(app.discord_id);
      if (member) {
        try {
          await member.send({
            embeds: [errorEmbed(
              'Aplicacion No Aceptada',
              'Gracias por tu interes, pero en este momento no pudimos aceptar tu aplicacion. ¡Buena suerte!',
            )],
          });
        } catch {
          // DMs disabled
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle(`Aplicacion #${appId} — RECHAZADA`)
        .setDescription(`**${app.character_name}-${app.realm}** fue rechazado por **${reviewer}**.`)
        .setTimestamp();
      await interaction.update({ embeds: [interaction.message.embeds[0], embed], components: [] });

    } else if (action === 'interview') {
      db.prepare("UPDATE applications SET status = 'interview', reviewed_by = ?, updated_at = datetime('now') WHERE id = ?")
        .run(reviewer, appId);

      const member = interaction.guild?.members.cache.get(app.discord_id);
      if (member) {
        try {
          await member.send({
            embeds: [infoEmbed(
              'Entrevista Solicitada',
              'Un oficial quiere hablar contigo antes de procesar tu aplicacion. Revisa el servidor y espera que te contacten.',
            )],
          });
        } catch {
          // DMs disabled
        }
      }

      const embed = infoEmbed(
        `Aplicacion #${appId} — ENTREVISTA`,
        `**${reviewer}** solicito entrevista con **${app.character_name}-${app.realm}**.`,
      );
      await interaction.update({ embeds: [interaction.message.embeds[0], embed], components: [] });
    }
  },
};

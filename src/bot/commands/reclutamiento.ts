import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { config } from '../../config.js';
import { getDb } from '../../db/database.js';
import { EMBED_COLORS } from '../../utils/constants.js';

export default {
  data: new SlashCommandBuilder()
    .setName('reclutamiento')
    .setDescription('Genera un template de reclutamiento para publicar en redes/foros')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) =>
      opt.setName('plataforma')
        .setDescription('Para donde es el post?')
        .setRequired(true)
        .addChoices(
          { name: 'Foros WoW / Reddit', value: 'forum' },
          { name: 'Discord (otros servidores)', value: 'discord' },
          { name: 'TikTok / YouTube Short', value: 'short' },
        ),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const plataforma = interaction.options.getString('plataforma', true);
    const db = getDb();
    const memberCount = (db.prepare('SELECT COUNT(DISTINCT discord_id) as c FROM characters').get() as { c: number }).c;

    const guildName = config.guild.name;
    const realm = config.guild.realm;
    const region = config.guild.region.toUpperCase();

    if (plataforma === 'forum') {
      const template = [
        `**[${region}] <${guildName}> ${realm} — Reclutando para nueva expansion**`,
        '',
        `**Guild:** ${guildName}`,
        `**Servidor:** ${realm} (${region})`,
        `**Tipo:** Semi-Hardcore | Heroic Raid + M+ Push`,
        `**Horario Raid:** [Tu horario aqui]`,
        `**Miembros activos:** ${memberCount}+`,
        '',
        `**Buscamos:**`,
        `- DPS (preferencia ranged)`,
        `- Healers con off-spec DPS`,
        `- Jugadores consistentes y con ganas de progresar`,
        '',
        `**Que ofrecemos:**`,
        `- Raid nights organizados con estrategia y buen ambiente`,
        `- Grupos de M+ activos toda la semana`,
        `- Discord organizado con bot custom (lookup de personajes, sign-ups, etc.)`,
        `- Comunidad activa y sin toxicidad`,
        '',
        `**Como aplicar:** Unite a nuestro Discord y usa /aplicar`,
        `Discord: [tu link de invitacion]`,
        '',
        `*¡Nos vemos en Azeroth!*`,
      ].join('\n');

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.wow)
        .setTitle('Template — Foros / Reddit')
        .setDescription(`\`\`\`\n${template}\n\`\`\``)
        .setFooter({ text: 'Copia y pega en el foro' });

      await interaction.editReply({ embeds: [embed] });

    } else if (plataforma === 'discord') {
      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.wow)
        .setTitle(`${guildName} esta reclutando!`)
        .setDescription([
          `**${guildName}** — ${realm} (${region})`,
          '',
          '**Heroic Raid + M+ Push Guild**',
          '',
          `Buscamos jugadores activos y comprometidos para la nueva expansion.`,
          '',
          '**Buscamos:** DPS, Healers, Off-tanks',
          '**Horario:** [Tu horario]',
          '',
          '**Beneficios:**',
          '- Bot custom con lookup de Raider.IO',
          '- Sistema de sign-up para raids y M+',
          '- Comunidad activa y organizada',
          '',
          '**Discord:** [tu invite link]',
          '**Aplica con:** `/aplicar`',
        ].join('\n'))
        .setThumbnail('https://wow.zamimg.com/images/wow/icons/large/inv_misc_tabardpvp_04.jpg')
        .setTimestamp();

      await interaction.editReply({ content: 'Embed listo para copiar:', embeds: [embed] });

    } else if (plataforma === 'short') {
      const script = [
        '**Script para TikTok/YouTube Short (30-60 seg):**',
        '',
        '---',
        '',
        `*[Hook — primeros 3 segundos]*`,
        `"Buscas guild para la nueva expansion de WoW? Escucha esto."`,
        '',
        `*[Cuerpo — 15-20 seg]*`,
        `"Somos ${guildName} en ${realm}. Hacemos Heroic Raid y push de M+.`,
        `Tenemos Discord organizado con bot custom que te da tu Raider.IO score,`,
        `sistema de sign-up para raids, y grupos de M+ todos los dias."`,
        '',
        `*[CTA — 5-10 seg]*`,
        `"Link del Discord en mi bio. Aplica con /aplicar y nos vemos en Azeroth."`,
        '',
        '---',
        '',
        '**Tips:**',
        '- Graba gameplay de fondo (raid kills, M+ runs)',
        '- Usa texto en pantalla con los puntos clave',
        '- Manten el tono energico pero no desesperado',
        `- Hashtags: #WoW #WorldOfWarcraft #WoWGuild #${guildName.replace(/\s+/g, '')} #GuildRecruitment`,
      ].join('\n');

      const embed = new EmbedBuilder()
        .setColor(0xFE2C55)
        .setTitle('Script — TikTok / YouTube Short')
        .setDescription(script);

      await interaction.editReply({ embeds: [embed] });
    }
  },
};

import { Events, EmbedBuilder, type GuildMember } from 'discord.js';
import { EMBED_COLORS } from '../../utils/constants.js';
import { findChannelByName } from '../../utils/channels.js';

export default {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member: GuildMember) {
    const invitadoRole = member.guild.roles.cache.find((r) => r.name === 'Invitado');
    if (invitadoRole) {
      try {
        await member.roles.add(invitadoRole, 'Auto-rol de bienvenida');
      } catch (err) {
        console.error('[guildMemberAdd] Error asignando rol Invitado:', err);
      }
    }

    const welcomeChannel = findChannelByName(member.guild, 'bienvenida');
    if (!welcomeChannel?.isTextBased()) return;

    const memberCount = member.guild.memberCount;
    const createdAt = Math.floor(member.user.createdTimestamp / 1000);

    const reglasId = findChannelByName(member.guild, 'reglas')?.id ?? '';
    const rolesId = findChannelByName(member.guild, 'roles')?.id ?? '';
    const chatGeneralId = findChannelByName(member.guild, 'chat-general')?.id ?? '';

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.success)
      .setTitle('Nuevo miembro!')
      .setDescription(
        `Bienvenido/a ${member} a la guild!\n\n` +
        `Eres el miembro **#${memberCount}** del servidor.\n\n` +
        `**Como empezar:**\n` +
        `> 1. Lee las reglas en <#${reglasId}>\n` +
        `> 2. Ve a <#${chatGeneralId}> y escribe:\n` +
        `> \`/vincular tu-personaje tu-servidor\`\n` +
        `> 3. Al vincular se desbloquean **todos** los canales: raids, M+, PvP, profesiones y mas\n\n` +
        `**Despues de vincular:**\n` +
        `> \`/profesiones registrar\` — Registra tus profesiones\n` +
        `> Elige notificaciones en <#${rolesId}>\n` +
        `> \`/help\` — Ve todos los comandos del bot`,
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'Cuenta creada', value: `<t:${createdAt}:R>`, inline: true },
      )
      .setFooter({ text: `ID: ${member.id}` })
      .setTimestamp();

    await welcomeChannel.send({ embeds: [embed] });

    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(EMBED_COLORS.wow)
        .setTitle(`Bienvenido a ${member.guild.name}!`)
        .setDescription(
          'Gracias por unirte. Sigue estos pasos:\n\n' +
          `**Paso 1 — Lee las reglas**\n` +
          `> Revisalas en <#${reglasId}>\n\n` +
          '**Paso 2 — Vincula tu personaje** (desbloquea el servidor)\n' +
          `> Ve a <#${chatGeneralId}> y escribe \`/vincular nombre realm\`\n` +
          '> Esto te promueve a **Miembro** y desbloquea raids, M+, PvP, profesiones y todos los canales.\n' +
          '> Puedes vincular varios personajes (main + alts).\n\n' +
          '**Paso 3 — Personaliza**\n' +
          `> Elige notificaciones y profesiones en <#${rolesId}>\n` +
          `> Registra profesiones con \`/profesiones registrar\`\n\n` +
          '`/help` te muestra todos los comandos.',
        )
        .setThumbnail(member.guild.iconURL({ size: 128 }))
        .setFooter({ text: 'Vincula tu personaje para ver todo el servidor.' })
        .setTimestamp();
      await member.send({ embeds: [dmEmbed] });
    } catch {
      // DMs disabled
    }

    const logChannel = findChannelByName(member.guild, 'log-moderacion');
    if (logChannel?.isTextBased()) {
      const logEmbed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('Miembro Entro')
        .setDescription(`${member} (${member.user.tag})`)
        .addFields(
          { name: 'ID', value: member.id, inline: true },
          { name: 'Cuenta creada', value: `<t:${createdAt}:R>`, inline: true },
          { name: 'Miembros totales', value: `${memberCount}`, inline: true },
        )
        .setThumbnail(member.user.displayAvatarURL({ size: 64 }))
        .setTimestamp();
      await logChannel.send({ embeds: [logEmbed] });
    }
  },
};

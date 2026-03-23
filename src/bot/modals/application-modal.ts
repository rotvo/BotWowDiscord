import {
  type ModalSubmitInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import { fetchCharacter } from '../../api/raiderio.js';
import { getDb } from '../../db/database.js';
import { config } from '../../config.js';
import { EMBED_COLORS, WOW_CLASS_COLORS } from '../../utils/constants.js';

export default {
  customId: 'application_modal',
  async execute(interaction: ModalSubmitInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const charInput = interaction.fields.getTextInputValue('character_name');
    const classSpec = interaction.fields.getTextInputValue('class_spec');
    const experience = interaction.fields.getTextInputValue('experience');
    const motivation = interaction.fields.getTextInputValue('motivation');
    const availability = interaction.fields.getTextInputValue('availability');

    const [charName, realm] = charInput.includes('-')
      ? charInput.split('-').map((s) => s.trim())
      : [charInput.trim(), config.guild.realm];

    const [wowClass, spec] = classSpec.includes('-')
      ? classSpec.split('-').map((s) => s.trim())
      : [classSpec.trim(), ''];

    const rioData = await fetchCharacter(charName, realm, config.guild.region);

    const db = getDb();
    db.prepare(`
      INSERT INTO applications (discord_id, discord_name, character_name, realm, wow_class, spec, experience, motivation, availability, raiderio_score, ilvl, raid_progress, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      interaction.user.id,
      interaction.user.tag,
      charName,
      realm,
      wowClass,
      spec,
      experience,
      motivation,
      availability,
      rioData?.mythic_plus_scores_by_season?.[0]?.scores?.all ?? null,
      rioData?.gear?.item_level_equipped ?? null,
      rioData ? JSON.stringify(rioData.raid_progression) : null,
    );

    const app = db.prepare(
      "SELECT id FROM applications WHERE discord_id = ? ORDER BY created_at DESC LIMIT 1",
    ).get(interaction.user.id) as { id: number };

    const classColor = WOW_CLASS_COLORS[wowClass] ?? EMBED_COLORS.info;
    const embed = new EmbedBuilder()
      .setColor(classColor)
      .setTitle(`Nueva Aplicacion #${app.id}`)
      .setAuthor({
        name: interaction.user.tag,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .addFields(
        { name: 'Personaje', value: `${charName}-${realm}`, inline: true },
        { name: 'Clase / Spec', value: classSpec, inline: true },
        { name: 'Disponibilidad', value: availability, inline: true },
        { name: 'Experiencia', value: experience },
        { name: 'Motivacion', value: motivation },
      )
      .setTimestamp();

    if (rioData) {
      const score = rioData.mythic_plus_scores_by_season?.[0]?.scores?.all ?? 0;
      const ilvl = rioData.gear?.item_level_equipped ?? 0;

      const bestRuns = rioData.mythic_plus_best_runs?.slice(0, 5)
        .map((r) => `${r.short_name} +${r.mythic_level} (${'★'.repeat(r.num_keystone_upgrades)})`)
        .join('\n') || 'Sin datos';

      const raids = Object.entries(rioData.raid_progression ?? {})
        .map(([name, p]) => `**${name}:** ${p.summary}`)
        .join('\n') || 'Sin datos';

      embed.addFields(
        { name: 'Raider.IO Score', value: `${score.toFixed(0)}`, inline: true },
        { name: 'Item Level', value: `${ilvl}`, inline: true },
        { name: 'Spec Activo', value: rioData.active_spec_name ?? 'N/A', inline: true },
        { name: 'Mejores M+', value: bestRuns },
        { name: 'Raid Progress', value: raids },
      );

      if (rioData.thumbnail_url) embed.setThumbnail(rioData.thumbnail_url);
      embed.setURL(rioData.profile_url);
    } else {
      embed.addFields({
        name: 'Raider.IO',
        value: '⚠ No se pudo obtener datos. Personaje no encontrado o API no disponible.',
      });
    }

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`app_accept_${app.id}`)
        .setLabel('Aceptar')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`app_interview_${app.id}`)
        .setLabel('Entrevistar')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`app_reject_${app.id}`)
        .setLabel('Rechazar')
        .setStyle(ButtonStyle.Danger),
    );

    const reviewChannel = interaction.guild?.channels.cache.find(
      (c) => c.name === 'revision-staff' && c.type === ChannelType.GuildText,
    );
    const appChannel = interaction.guild?.channels.cache.find(
      (c) => c.name === 'aplicaciones' && c.type === ChannelType.GuildText,
    );

    if (reviewChannel && reviewChannel.isTextBased()) {
      await reviewChannel.send({ embeds: [embed], components: [buttons] });
    }

    if (appChannel && appChannel.isTextBased()) {
      const publicEmbed = new EmbedBuilder()
        .setColor(classColor)
        .setTitle(`Nueva Aplicacion`)
        .setDescription(`**${charName}-${realm}** (${classSpec}) ha aplicado a la guild.`)
        .setTimestamp();
      await appChannel.send({ embeds: [publicEmbed] });
    }

    await interaction.editReply(
      'Tu aplicacion fue enviada. Los oficiales la revisaran pronto. ¡Gracias!',
    );
  },
};

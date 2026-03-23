import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { getDb } from '../../db/database.js';
import { config } from '../../config.js';
import { EMBED_COLORS } from '../../utils/constants.js';
import { findChannelByName } from '../../utils/channels.js';
import {
  parseDateRange,
  parseTimeRange,
  localToUtc,
  getDayTimestamps,
} from '../../utils/datetime.js';

function buildRaidDescription(
  descripcion: string,
  minIlvl: number,
  dayTimestamps: number[],
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
  createdBy: string,
  isRange: boolean,
): string {
  const ilvlLine = minIlvl > 0 ? `**iLvl Minimo:** ${minIlvl}\n` : '';
  const timeStr = `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')} - ${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

  if (isRange && dayTimestamps.length > 1) {
    const daysLine = dayTimestamps
      .map((ts) => `<t:${ts}:F>`)
      .join(' · ');
    return [
      descripcion ? `${descripcion}\n` : '',
      `**Dias:** ${daysLine}`,
      `**Horario:** ${timeStr} (cada uno ve su zona)`,
      `**Countdown:** <t:${dayTimestamps[0]}:R>`,
      `**Creado por:** ${createdBy}`,
      ilvlLine,
      '**Composicion:**',
      '🛡️ Tanks: *ninguno*',
      '💚 Healers: *ninguno*',
      '⚔️ DPS: *ninguno*',
      '',
      '⏳ Tentativos: *ninguno*',
      '❌ No pueden: *ninguno*',
    ].join('\n');
  }

  const ts = dayTimestamps[0];
  return [
    descripcion ? `${descripcion}\n` : '',
    `**Fecha:** <t:${ts}:F>`,
    `**Horario:** ${timeStr}`,
    `**Countdown:** <t:${ts}:R>`,
    `**Creado por:** ${createdBy}`,
    ilvlLine,
    '**Composicion:**',
    '🛡️ Tanks: *ninguno*',
    '💚 Healers: *ninguno*',
    '⚔️ DPS: *ninguno*',
    '',
    '⏳ Tentativos: *ninguno*',
    '❌ No pueden: *ninguno*',
  ].join('\n');
}

export default {
  data: new SlashCommandBuilder()
    .setName('crear-raid')
    .setDescription('Crea un evento de raid (solo oficiales)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption((opt) =>
      opt.setName('titulo')
        .setDescription('Nombre del raid')
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName('dificultad')
        .setDescription('Dificultad del raid')
        .setRequired(true)
        .addChoices(
          { name: 'Normal', value: 'Normal' },
          { name: 'Heroic', value: 'Heroic' },
          { name: 'Mythic', value: 'Mythic' },
        ),
    )
    .addStringOption((opt) =>
      opt.setName('fecha_inicio')
        .setDescription('Primer dia (formato: 2026-03-15)')
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName('horario')
        .setDescription('Hora inicio-fin en tu zona (Ej: 21-23 o 21:00-23:00)')
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName('fecha_fin')
        .setDescription('Ultimo dia (opcional, mismo formato. Si omites, es un solo dia)')
        .setRequired(false),
    )
    .addStringOption((opt) =>
      opt.setName('descripcion')
        .setDescription('Descripcion o bosses objetivo')
        .setRequired(false),
    )
    .addIntegerOption((opt) =>
      opt.setName('ilvl-minimo')
        .setDescription('Item level minimo para anotarse (opcional)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(700),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const titulo = interaction.options.getString('titulo', true);
    const dificultad = interaction.options.getString('dificultad', true);
    const fechaInicioStr = interaction.options.getString('fecha_inicio', true);
    const fechaFinStr = interaction.options.getString('fecha_fin');
    const horarioStr = interaction.options.getString('horario', true);
    const descripcion = interaction.options.getString('descripcion') ?? '';
    const minIlvl = interaction.options.getInteger('ilvl-minimo') ?? 0;

    const offsetHours = config.coreRaid.utcOffsetHours;

    const dateRange = parseDateRange(fechaInicioStr, fechaFinStr ?? undefined);
    if (!dateRange) {
      await interaction.reply({
        content: 'Fecha invalida. Usa formato YYYY-MM-DD (ej: 2026-03-15). Si usas fecha_fin, debe ser igual o posterior a fecha_inicio.',
        ephemeral: true,
      });
      return;
    }

    const timeRange = parseTimeRange(horarioStr);
    if (!timeRange) {
      await interaction.reply({
        content: 'Horario invalido. Usa formato 21-23 o 21:00-23:00 (hora en tu zona).',
        ephemeral: true,
      });
      return;
    }

    const { start: dateStart, end: dateEnd } = dateRange;
    const { startHour, startMinute, endHour, endMinute } = timeRange;

    const year = dateStart.getUTCFullYear();
    const month = dateStart.getUTCMonth();
    const day = dateStart.getUTCDate();
    const scheduledAt = localToUtc(year, month, day, startHour, startMinute, offsetHours);

    if (scheduledAt.getTime() <= Date.now()) {
      await interaction.reply({ content: 'La fecha debe ser en el futuro.', ephemeral: true });
      return;
    }

    const isRange = fechaFinStr != null && fechaFinStr.trim() !== '';
    const dateEndForDb = isRange
      ? `${dateEnd.getUTCFullYear()}-${String(dateEnd.getUTCMonth() + 1).padStart(2, '0')}-${String(dateEnd.getUTCDate()).padStart(2, '0')}`
      : null;

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO raids (title, difficulty, description, scheduled_at, created_by, status, min_ilvl, date_end, start_hour, start_minute, end_hour, end_minute)
      VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?, ?, ?, ?, ?)
    `).run(
      titulo,
      dificultad,
      descripcion,
      scheduledAt.toISOString(),
      interaction.user.id,
      minIlvl,
      dateEndForDb,
      startHour,
      startMinute,
      endHour,
      endMinute,
    );

    const raidId = result.lastInsertRowid as number;

    const dayTimestamps = getDayTimestamps(dateStart, dateEnd, startHour, startMinute, offsetHours);

    const diffColors: Record<string, number> = {
      'Normal': 0x2ECC71,
      'Heroic': 0x9B59B6,
      'Mythic': 0xE74C3C,
    };

    const embed = new EmbedBuilder()
      .setColor(diffColors[dificultad] ?? EMBED_COLORS.wow)
      .setTitle(`${titulo} — ${dificultad}`)
      .setDescription(
        buildRaidDescription(
          descripcion,
          minIlvl,
          dayTimestamps,
          startHour,
          startMinute,
          endHour,
          endMinute,
          interaction.user.toString(),
          isRange,
        ),
      )
      .setFooter({ text: `Raid ID: ${raidId}` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`raid_signup_tank_${raidId}`)
        .setLabel('Tank')
        .setEmoji('🛡️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`raid_signup_healer_${raidId}`)
        .setLabel('Healer')
        .setEmoji('💚')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`raid_signup_dps_${raidId}`)
        .setLabel('DPS')
        .setEmoji('⚔️')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`raid_signup_tentative_${raidId}`)
        .setLabel('Tentativo')
        .setEmoji('⏳')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`raid_signup_absent_${raidId}`)
        .setLabel('No puedo')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Secondary),
    );

    const signupChannel = findChannelByName(interaction.guild!, 'asistencia-raid');
    const isText = signupChannel?.type === ChannelType.GuildText;
    const targetChannel = isText ? signupChannel : (interaction.channel && 'send' in interaction.channel ? interaction.channel : null);
    if (!targetChannel || !('send' in targetChannel)) {
      await interaction.reply({ content: 'No se encontro canal para el signup.', ephemeral: true });
      return;
    }

    const msg = await (targetChannel as import('discord.js').TextChannel).send({ embeds: [embed], components: [row] });

    db.prepare('UPDATE raids SET message_id = ?, channel_id = ? WHERE id = ?')
      .run(msg.id, msg.channelId, raidId);

    const raiderRole = interaction.guild?.roles.cache.find((r) => r.name === 'Raider');
    if (raiderRole) {
      await (targetChannel as import('discord.js').TextChannel).send(`${raiderRole} Nuevo raid programado!`);
    }

    await interaction.reply({ content: `Raid creado en ${targetChannel}`, ephemeral: true });
  },
};

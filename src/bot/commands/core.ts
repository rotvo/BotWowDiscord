import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { getDb } from '../../db/database.js';
import { findChannelByName, getChannelDisplayName } from '../../utils/channels.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import {
  buildCoreEmbed,
  setCoreConfig,
  getCoreConfig,
  removeCoreMember,
  refreshCoreMessage,
} from '../../utils/core-embed.js';

function buildCoreButtons(): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('core_signup_Tank')
      .setLabel('🛡️ Tank')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('core_signup_Healer')
      .setLabel('💚 Healer')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('core_signup_DPS Melee')
      .setLabel('⚔️ DPS Melee')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('core_signup_DPS Ranged')
      .setLabel('🏹 DPS Ranged')
      .setStyle(ButtonStyle.Danger),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('core_leave')
      .setLabel('❌ Salir del Core')
      .setStyle(ButtonStyle.Danger),
  );

  return [row1, row2];
}

export { buildCoreButtons };

export default {
  data: new SlashCommandBuilder()
    .setName('core')
    .setDescription('Gestiona el Core Raid de la guild')
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Crea o reconfigura el canal #core-raid con el panel de inscripción (Admin)')
    )
    .addSubcommand((sub) =>
      sub
        .setName('kick')
        .setDescription('Remueve a un miembro del core (Admin)')
        .addUserOption((opt) =>
          opt.setName('usuario').setDescription('El miembro a remover del core').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('reset')
        .setDescription('Reinicia el core completo, removiendo a todos los miembros (Admin)'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('actualizar')
        .setDescription('Fuerza la actualización del embed del core'),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: 'Solo funciona en un servidor.', ephemeral: true });
      return;
    }

    if (sub === 'setup') {
      await handleSetup(interaction);
    } else if (sub === 'kick') {
      await handleKick(interaction);
    } else if (sub === 'reset') {
      await handleReset(interaction);
    } else if (sub === 'actualizar') {
      await handleRefresh(interaction);
    }
  },
};

async function handleSetup(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild!;

  let channel = findChannelByName(guild, 'core-raid');

  if (!channel) {
    const raidCategory = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name.toUpperCase().includes('RAID'),
    );

    channel = await guild.channels.create({
      name: getChannelDisplayName('core-raid'),
      type: ChannelType.GuildText,
      topic: '🏰 Composición del Core de raid. Inscríbete con los botones. Se actualiza en tiempo real.',
      parent: raidCategory?.id,
      reason: 'Core Raid: setup automático',
    });
  }

  if (!channel.isTextBased()) {
    await interaction.editReply({ embeds: [errorEmbed('Error', 'El canal core-raid no es de texto.')] });
    return;
  }

  const textChannel = channel as import('discord.js').TextChannel;

  const cfg = getCoreConfig(guild.id);
  if (cfg.message_id) {
    try {
      const oldMsg = await textChannel.messages.fetch(cfg.message_id);
      await oldMsg.delete();
    } catch { /* may not exist */ }
  }

  const embed = buildCoreEmbed();
  const buttons = buildCoreButtons();
  const msg = await textChannel.send({ embeds: [embed], components: buttons });

  setCoreConfig(guild.id, textChannel.id, msg.id);

  await interaction.editReply({
    embeds: [successEmbed(
      'Core Raid Configurado',
      `Canal: <#${textChannel.id}>\nEl panel de inscripción está listo. Los miembros pueden usar los botones para inscribirse.`,
    )],
  });
}

async function handleKick(interaction: ChatInputCommandInteraction): Promise<void> {
  const target = interaction.options.getUser('usuario', true);
  const removed = removeCoreMember(target.id);

  if (!removed) {
    await interaction.reply({
      embeds: [errorEmbed('No encontrado', `<@${target.id}> no está en el core.`)],
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    embeds: [successEmbed('Miembro Removido', `<@${target.id}> fue removido del core.`)],
    ephemeral: true,
  });

  await refreshCoreMessage(interaction.guild!);
}

async function handleReset(interaction: ChatInputCommandInteraction): Promise<void> {
  const db = getDb();
  db.prepare('DELETE FROM core_members').run();

  await interaction.reply({
    embeds: [successEmbed('Core Reiniciado', 'Todos los miembros fueron removidos del core.')],
    ephemeral: true,
  });

  await refreshCoreMessage(interaction.guild!);
}

async function handleRefresh(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const success = await refreshCoreMessage(interaction.guild!);

  if (success) {
    await interaction.editReply({
      embeds: [successEmbed('Actualizado', 'El panel del core fue actualizado.')],
    });
  } else {
    await interaction.editReply({
      embeds: [errorEmbed('Error', 'No se pudo actualizar. Usa `/core setup` para configurar el canal.')],
    });
  }
}

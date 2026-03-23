import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { getDb } from '../../db/database.js';
import { WOW_PROFESSIONS, WOW_PROFESSION_COLORS, EMBED_COLORS } from '../../utils/constants.js';
import { findChannelByName } from '../../utils/channels.js';
import { successEmbed, errorEmbed, wowEmbed } from '../../utils/embeds.js';
import { getCharacters } from './vincular.js';

const profChoices = WOW_PROFESSIONS.map((p) => ({ name: p, value: p }));

export default {
  data: new SlashCommandBuilder()
    .setName('crafting-order')
    .setDescription('Sistema de pedidos de crafteo entre guildies')
    .addSubcommand((sub) =>
      sub
        .setName('crear')
        .setDescription('Crea un pedido de crafteo')
        .addStringOption((opt) =>
          opt
            .setName('profesion')
            .setDescription('Profesion requerida')
            .setRequired(true)
            .addChoices(...profChoices),
        )
        .addStringOption((opt) =>
          opt.setName('item').setDescription('Nombre del item que necesitas').setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName('descripcion').setDescription('Detalles adicionales (materiales, stats, etc)').setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('completar')
        .setDescription('Marca un pedido como completado')
        .addIntegerOption((opt) =>
          opt.setName('id').setDescription('ID del pedido').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('cancelar')
        .setDescription('Cancela un pedido pendiente')
        .addIntegerOption((opt) =>
          opt.setName('id').setDescription('ID del pedido').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('mis-pedidos').setDescription('Ve tus pedidos activos'),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'crear') {
      await handleCrear(interaction);
    } else if (sub === 'completar') {
      await handleCompletar(interaction);
    } else if (sub === 'cancelar') {
      await handleCancelar(interaction);
    } else if (sub === 'mis-pedidos') {
      await handleMisPedidos(interaction);
    }
  },
};

async function handleCrear(interaction: ChatInputCommandInteraction): Promise<void> {
  const chars = getCharacters(interaction.user.id);
  if (chars.length === 0) {
    await interaction.reply({
      embeds: [errorEmbed('Sin personaje vinculado', 'Necesitas vincular al menos un personaje con `/vincular nombre realm` antes de crear un pedido.')],
      ephemeral: true,
    });
    return;
  }

  const profession = interaction.options.getString('profesion', true);
  const itemName = interaction.options.getString('item', true);
  const description = interaction.options.getString('descripcion') ?? null;

  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO crafting_orders (requester_id, profession, item_name, description)
       VALUES (?, ?, ?, ?)`,
    )
    .run(interaction.user.id, profession, itemName, description);

  const orderId = result.lastInsertRowid;
  const color = WOW_PROFESSION_COLORS[profession] ?? EMBED_COLORS.wow;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`Pedido de Crafteo #${orderId}`)
    .addFields(
      { name: 'Item', value: itemName, inline: true },
      { name: 'Profesion', value: profession, inline: true },
      { name: 'Solicitado por', value: `<@${interaction.user.id}>`, inline: true },
    )
    .setTimestamp();

  if (description) {
    embed.setDescription(description);
  }

  const acceptBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`craft_accept_${orderId}`)
      .setLabel('Yo lo crafteo')
      .setStyle(ButtonStyle.Success),
  );

    const craftingChannel = findChannelByName(interaction.guild!, 'crafting-orders');

  if (craftingChannel?.isTextBased()) {
    const msg = await craftingChannel.send({ embeds: [embed], components: [acceptBtn] });

    db.prepare(
      `UPDATE crafting_orders SET message_id = ?, channel_id = ? WHERE id = ?`,
    ).run(msg.id, msg.channelId, orderId);

    await interaction.reply({
      embeds: [successEmbed('Pedido Creado', `Tu pedido #${orderId} fue publicado en <#${craftingChannel.id}>.`)],
      ephemeral: true,
    });
  } else {
    await interaction.reply({
      embeds: [embed],
      components: [acceptBtn],
    });
  }
}

async function handleCompletar(interaction: ChatInputCommandInteraction): Promise<void> {
  const orderId = interaction.options.getInteger('id', true);
  const db = getDb();

  const order = db
    .prepare(`SELECT * FROM crafting_orders WHERE id = ?`)
    .get(orderId) as {
    id: number;
    requester_id: string;
    crafter_id: string | null;
    profession: string;
    item_name: string;
    status: string;
    message_id: string | null;
    channel_id: string | null;
  } | undefined;

  if (!order) {
    await interaction.reply({
      embeds: [errorEmbed('Error', `Pedido #${orderId} no encontrado.`)],
      ephemeral: true,
    });
    return;
  }

  if (order.status === 'completed') {
    await interaction.reply({
      embeds: [errorEmbed('Error', `Pedido #${orderId} ya esta completado.`)],
      ephemeral: true,
    });
    return;
  }

  const userId = interaction.user.id;
  if (order.crafter_id !== userId && order.requester_id !== userId) {
    await interaction.reply({
      embeds: [errorEmbed('Error', 'Solo el crafter asignado o el solicitante pueden completar este pedido.')],
      ephemeral: true,
    });
    return;
  }

  db.prepare(
    `UPDATE crafting_orders SET status = 'completed', completed_at = datetime('now') WHERE id = ?`,
  ).run(orderId);

  if (order.message_id && order.channel_id) {
    try {
      const channel = interaction.guild?.channels.cache.get(order.channel_id);
      if (channel?.isTextBased()) {
        const msg = await channel.messages.fetch(order.message_id);
        const updatedEmbed = EmbedBuilder.from(msg.embeds[0])
          .setColor(0x57F287)
          .addFields({ name: 'Estado', value: 'Completado', inline: true });
        await msg.edit({ embeds: [updatedEmbed], components: [] });
      }
    } catch {
      // Message may have been deleted
    }
  }

  await interaction.reply({
    embeds: [successEmbed('Pedido Completado', `El pedido #${orderId} (**${order.item_name}**) ha sido marcado como completado.`)],
  });
}

async function handleCancelar(interaction: ChatInputCommandInteraction): Promise<void> {
  const orderId = interaction.options.getInteger('id', true);
  const db = getDb();

  const order = db
    .prepare(`SELECT * FROM crafting_orders WHERE id = ?`)
    .get(orderId) as {
    id: number;
    requester_id: string;
    crafter_id: string | null;
    profession: string;
    item_name: string;
    status: string;
    message_id: string | null;
    channel_id: string | null;
  } | undefined;

  if (!order) {
    await interaction.reply({
      embeds: [errorEmbed('Error', `Pedido #${orderId} no encontrado.`)],
      ephemeral: true,
    });
    return;
  }

  if (order.status === 'completed') {
    await interaction.reply({
      embeds: [errorEmbed('Error', `Pedido #${orderId} ya esta completado y no se puede cancelar.`)],
      ephemeral: true,
    });
    return;
  }

  if (order.status === 'cancelled') {
    await interaction.reply({
      embeds: [errorEmbed('Error', `Pedido #${orderId} ya esta cancelado.`)],
      ephemeral: true,
    });
    return;
  }

  const isOwner = order.requester_id === interaction.user.id;
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;

  if (!isOwner && !isAdmin) {
    await interaction.reply({
      embeds: [errorEmbed('Error', 'Solo el creador del pedido o un administrador puede cancelarlo.')],
      ephemeral: true,
    });
    return;
  }

  db.prepare(`UPDATE crafting_orders SET status = 'cancelled' WHERE id = ?`).run(orderId);

  if (order.message_id && order.channel_id) {
    try {
      const channel = interaction.guild?.channels.cache.get(order.channel_id);
      if (channel?.isTextBased()) {
        const msg = await channel.messages.fetch(order.message_id);
        const updatedEmbed = EmbedBuilder.from(msg.embeds[0])
          .setColor(0x95A5A6)
          .setTitle(`~~Pedido de Crafteo #${orderId}~~ — CANCELADO`);
        await msg.edit({ embeds: [updatedEmbed], components: [] });
      }
    } catch {
      // Message may have been deleted
    }
  }

  await interaction.reply({
    embeds: [successEmbed('Pedido Cancelado', `El pedido #${orderId} (**${order.item_name}**) ha sido cancelado.`)],
    ephemeral: true,
  });
}

async function handleMisPedidos(interaction: ChatInputCommandInteraction): Promise<void> {
  const db = getDb();
  const userId = interaction.user.id;

  const asRequester = db
    .prepare(
      `SELECT id, profession, item_name, status, crafter_id, created_at
       FROM crafting_orders
       WHERE requester_id = ? AND status NOT IN ('completed', 'cancelled')
       ORDER BY created_at DESC`,
    )
    .all(userId) as {
    id: number;
    profession: string;
    item_name: string;
    status: string;
    crafter_id: string | null;
    created_at: string;
  }[];

  const asCrafter = db
    .prepare(
      `SELECT id, profession, item_name, requester_id, created_at
       FROM crafting_orders
       WHERE crafter_id = ? AND status = 'accepted'
       ORDER BY created_at DESC`,
    )
    .all(userId) as {
    id: number;
    profession: string;
    item_name: string;
    requester_id: string;
    created_at: string;
  }[];

  if (asRequester.length === 0 && asCrafter.length === 0) {
    await interaction.reply({
      embeds: [wowEmbed('Mis Pedidos', 'No tienes pedidos activos.')],
      ephemeral: true,
    });
    return;
  }

  const lines: string[] = [];

  if (asRequester.length > 0) {
    lines.push('**Mis Solicitudes:**');
    for (const o of asRequester) {
      const crafterStr = o.crafter_id ? `Crafter: <@${o.crafter_id}>` : 'Sin crafter';
      lines.push(`#${o.id} — **${o.item_name}** (${o.profession}) — ${crafterStr}`);
    }
  }

  if (asCrafter.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('**Pedidos que estoy crafteando:**');
    for (const o of asCrafter) {
      lines.push(`#${o.id} — **${o.item_name}** (${o.profession}) — Para: <@${o.requester_id}>`);
    }
  }

  const embed = wowEmbed('Mis Pedidos', lines.join('\n'));
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

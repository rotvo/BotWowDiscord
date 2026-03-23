import {
  type StringSelectMenuInteraction,
  EmbedBuilder,
} from 'discord.js';
import { getDb } from '../../db/database.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { getCharacterById } from '../commands/vincular.js';
import { notifyRequester } from '../../utils/helpers.js';

export default {
  customId: 'charsel_craft_',
  async execute(interaction: StringSelectMenuInteraction) {
    // customId format: charsel_craft_{orderId}
    const orderId = parseInt(interaction.customId.replace('charsel_craft_', ''), 10);
    const charId = parseInt(interaction.values[0], 10);

    const character = getCharacterById(charId);
    if (!character || character.discord_id !== interaction.user.id) {
      await interaction.reply({ embeds: [errorEmbed('Error', 'Personaje no valido.')], ephemeral: true });
      return;
    }

    const db = getDb();
    const order = db.prepare(`SELECT * FROM crafting_orders WHERE id = ?`).get(orderId) as {
      id: number;
      requester_id: string;
      item_name: string;
      profession: string;
      status: string;
      message_id: string | null;
      channel_id: string | null;
    } | undefined;

    if (!order || order.status !== 'open') {
      await interaction.reply({ embeds: [errorEmbed('Error', 'Este pedido ya no esta disponible.')], ephemeral: true });
      return;
    }

    db.prepare(
      `UPDATE crafting_orders SET crafter_id = ?, crafter_character_id = ?, status = 'accepted' WHERE id = ?`,
    ).run(interaction.user.id, character.id, orderId);

    if (order.message_id && order.channel_id) {
      try {
        const channel = interaction.guild?.channels.cache.get(order.channel_id);
        if (channel?.isTextBased()) {
          const msg = await channel.messages.fetch(order.message_id);
          const originalEmbed = msg.embeds[0];
          const updatedEmbed = EmbedBuilder.from(originalEmbed)
            .addFields(
              { name: 'Crafter', value: `<@${interaction.user.id}> (${character.wow_character})`, inline: true },
              { name: 'Estado', value: 'Aceptado', inline: true },
            )
            .setColor(0xF1C40F);
          await msg.edit({ embeds: [updatedEmbed], components: [] });
        }
      } catch { /* message may not be editable */ }
    }

    await interaction.reply({
      embeds: [successEmbed(
        'Pedido Aceptado',
        `Aceptaste el pedido #${orderId} con **${character.wow_character}** — **${order.item_name}** (${order.profession}).\n` +
        `Contacta a <@${order.requester_id}> para coordinar.\n` +
        `Usa \`/crafting-order completar ${orderId}\` cuando termines.`,
      )],
      ephemeral: true,
    });

    await notifyRequester(interaction.client, order.requester_id, order.item_name, order.profession, interaction.user.id, character.wow_character);
  },
};


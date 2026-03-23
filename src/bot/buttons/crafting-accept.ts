import {
  EmbedBuilder,
  type ButtonInteraction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { getDb } from '../../db/database.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { getCharacters, type CharacterRow } from '../commands/vincular.js';
import { notifyRequester } from '../../utils/helpers.js';

function getCharsWithProfession(discordId: string, profession: string): CharacterRow[] {
  const db = getDb();
  const chars = getCharacters(discordId);
  if (chars.length === 0) return [];

  const charIdsWithProf = db.prepare(
    `SELECT DISTINCT character_id FROM member_professions WHERE discord_id = ? AND profession = ? AND character_id > 0`,
  ).all(discordId, profession) as { character_id: number }[];

  const charIdSet = new Set(charIdsWithProf.map((r) => r.character_id));
  return chars.filter((c) => charIdSet.has(c.id));
}

function hasRoleForProfession(interaction: ButtonInteraction, profession: string): boolean {
  return !!(
    interaction.member &&
    'roles' in interaction.member &&
    typeof interaction.member.roles !== 'string' &&
    'cache' in interaction.member.roles &&
    interaction.member.roles.cache.some((r) => r.name === profession)
  );
}

export default {
  customId: 'craft_accept_',
  async execute(interaction: ButtonInteraction) {
    const orderId = parseInt(interaction.customId.replace('craft_accept_', ''), 10);
    if (isNaN(orderId)) return;

    const db = getDb();
    const order = db
      .prepare(`SELECT * FROM crafting_orders WHERE id = ?`)
      .get(orderId) as {
      id: number;
      requester_id: string;
      crafter_id: string | null;
      item_name: string;
      profession: string;
      status: string;
      message_id: string | null;
      channel_id: string | null;
    } | undefined;

    if (!order) {
      await interaction.reply({ embeds: [errorEmbed('Error', 'Este pedido ya no existe.')], ephemeral: true });
      return;
    }

    if (order.status !== 'open') {
      const crafterMention = order.crafter_id ? `<@${order.crafter_id}>` : 'alguien';
      await interaction.reply({ embeds: [errorEmbed('Pedido Tomado', `Ya fue aceptado por ${crafterMention}.`)], ephemeral: true });
      return;
    }

    if (order.requester_id === interaction.user.id) {
      await interaction.reply({ embeds: [errorEmbed('Error', 'No puedes aceptar tu propio pedido.')], ephemeral: true });
      return;
    }

    const qualifiedChars = getCharsWithProfession(interaction.user.id, order.profession);
    const hasRole = hasRoleForProfession(interaction, order.profession);

    if (qualifiedChars.length === 0 && !hasRole) {
      await interaction.reply({
        embeds: [errorEmbed(
          'Sin Profesion',
          `Ninguno de tus personajes tiene **${order.profession}** registrada.\n` +
          `Usa \`/profesiones registrar\` para registrar la profesion en un personaje, o asignate el rol en #roles.`,
        )],
        ephemeral: true,
      });
      return;
    }

    if (qualifiedChars.length === 1) {
      await acceptOrder(interaction, db, order, qualifiedChars[0]);
    } else if (qualifiedChars.length > 1) {
      const selectMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`charsel_craft_${orderId}`)
          .setPlaceholder('Elige con que personaje crafteas...')
          .addOptions(
            qualifiedChars.map((c) => ({
              label: `${c.wow_character}-${c.wow_realm}`,
              description: `${c.wow_class ?? '?'} ${c.wow_spec ?? '?'} - ${c.ilvl} ilvl`,
              value: String(c.id),
            })),
          ),
      );

      await interaction.reply({
        content: `${qualifiedChars.length} personajes tienen **${order.profession}**. Elige con cual crafteas:`,
        components: [selectMenu],
        ephemeral: true,
      });
    } else {
      // Has Discord role but no character-linked profession — accept without character
      db.prepare(
        `UPDATE crafting_orders SET crafter_id = ?, status = 'accepted' WHERE id = ?`,
      ).run(interaction.user.id, orderId);

      if (interaction.message) {
        try {
          const originalEmbed = interaction.message.embeds[0];
          const updatedEmbed = EmbedBuilder.from(originalEmbed)
            .addFields(
              { name: 'Crafter', value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Estado', value: 'Aceptado', inline: true },
            )
            .setColor(0xF1C40F);
          await interaction.message.edit({ embeds: [updatedEmbed], components: [] });
        } catch { /* not editable */ }
      }

      await interaction.reply({
        embeds: [successEmbed(
          'Pedido Aceptado',
          `Aceptaste #${orderId} — **${order.item_name}** (${order.profession}).\n` +
          `Contacta a <@${order.requester_id}> para coordinar.\nUsa \`/crafting-order completar ${orderId}\` cuando termines.`,
        )],
        ephemeral: true,
      });

      await notifyRequester(interaction.client, order.requester_id, order.item_name, order.profession, interaction.user.id);
    }
  },
};

async function acceptOrder(
  interaction: ButtonInteraction,
  db: ReturnType<typeof getDb>,
  order: { id: number; requester_id: string; item_name: string; profession: string; message_id: string | null; channel_id: string | null },
  character: CharacterRow,
): Promise<void> {
  db.prepare(
    `UPDATE crafting_orders SET crafter_id = ?, crafter_character_id = ?, status = 'accepted' WHERE id = ?`,
  ).run(interaction.user.id, character.id, order.id);

  if (interaction.message) {
    try {
      const originalEmbed = interaction.message.embeds[0];
      const updatedEmbed = EmbedBuilder.from(originalEmbed)
        .addFields(
          { name: 'Crafter', value: `<@${interaction.user.id}> (${character.wow_character})`, inline: true },
          { name: 'Estado', value: 'Aceptado', inline: true },
        )
        .setColor(0xF1C40F);
      await interaction.message.edit({ embeds: [updatedEmbed], components: [] });
    } catch { /* not editable */ }
  }

  await interaction.reply({
    embeds: [successEmbed(
      'Pedido Aceptado',
      `Aceptaste #${order.id} con **${character.wow_character}** — **${order.item_name}** (${order.profession}).\n` +
      `Contacta a <@${order.requester_id}> para coordinar.\nUsa \`/crafting-order completar ${order.id}\` cuando termines.`,
    )],
    ephemeral: true,
  });

  await notifyRequester(interaction.client, order.requester_id, order.item_name, order.profession, interaction.user.id, character.wow_character);
}


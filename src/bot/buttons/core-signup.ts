import {
  type ButtonInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
} from 'discord.js';
import { errorEmbed, successEmbed, wowEmbed } from '../../utils/embeds.js';
import { getCharacters, type CharacterRow } from '../commands/vincular.js';
import {
  addCoreMember,
  removeCoreMember,
  getCoreMember,
  refreshCoreMessage,
  hasAcceptedTerms,
  acceptTerms,
  setPendingSignup,
  getPendingSignup,
  clearPendingSignup,
  notifyAdminCoreSignup,
} from '../../utils/core-embed.js';
import { CORE_TERMS_TEXT } from '../../utils/core-terms.js';

function buildCharSelectMenu(chars: CharacterRow[], role: string): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`charsel_core_${role}`)
      .setPlaceholder('Elige con qué personaje te inscribes...')
      .addOptions(
        chars.map((c) => ({
          label: `${c.wow_character}-${c.wow_realm}`,
          description: `${c.wow_class ?? '?'} ${c.wow_spec ?? '?'} — ${c.ilvl} ilvl${c.is_main ? ' (Main)' : ''}`,
          value: String(c.id),
        })),
      ),
  );
}

async function completeCoreSignup(
  interaction: ButtonInteraction,
  role: string,
  character: CharacterRow,
  isFirstTime: boolean,
): Promise<void> {
  const existing = getCoreMember(interaction.user.id);

  if (existing && existing.role === role && existing.character_id === character.id) {
    removeCoreMember(interaction.user.id);
    await interaction.reply({
      embeds: [successEmbed('Removido del Core', `Te saliste del core como **${role}**.`)],
      ephemeral: true,
    });
  } else {
    addCoreMember(interaction.user.id, character.id, role);
    const action = existing ? 'Actualizado' : 'Inscrito';
    const entrevistaMsg = isFirstTime
      ? '\n\nUn oficial te contactará para tu entrevista.'
      : '';
    await interaction.reply({
      embeds: [successEmbed(
        `✅ ${action} en el Core`,
        `Te inscribiste como **${role}** con **${character.wow_character}** (${character.wow_class} ${character.wow_spec} — ${character.ilvl} ilvl).${entrevistaMsg}`,
      )],
      ephemeral: true,
    });

    if (isFirstTime) {
      await notifyAdminCoreSignup(
        interaction.client,
        interaction.user.id,
        interaction.user.displayName,
        role,
        `${character.wow_character} (${character.wow_class} ${character.wow_spec} — ${character.ilvl} ilvl)`,
      );
    }
  }

  if (interaction.guild) {
    await refreshCoreMessage(interaction.guild);
  }
}

export default {
  customId: 'core_',
  async execute(interaction: ButtonInteraction) {
    // ── Salir del Core ──
    if (interaction.customId === 'core_leave') {
      const existing = getCoreMember(interaction.user.id);
      if (!existing) {
        await interaction.reply({
          embeds: [errorEmbed('No estás en el Core', 'No tienes inscripción activa en el core.')],
          ephemeral: true,
        });
        return;
      }

      removeCoreMember(interaction.user.id);
      await interaction.reply({
        embeds: [successEmbed('Saliste del Core', 'Tu inscripción fue removida del core.')],
        ephemeral: true,
      });

      if (interaction.guild) {
        await refreshCoreMessage(interaction.guild);
      }
      return;
    }

    // ── Aceptar términos ──
    if (interaction.customId === 'core_terms_accept') {
      const pending = getPendingSignup(interaction.user.id);
      if (!pending) {
        await interaction.reply({
          embeds: [errorEmbed('Sesión expirada', 'Vuelve a hacer clic en el botón de tu rol para inscribirte.')],
          ephemeral: true,
        });
        return;
      }

      acceptTerms(interaction.user.id);
      clearPendingSignup(interaction.user.id);

      const chars = getCharacters(interaction.user.id);
      if (chars.length === 0) {
        await interaction.reply({
          embeds: [errorEmbed('Sin personajes', 'Ya no tienes personajes vinculados. Usa `/vincular` primero.')],
          ephemeral: true,
        });
        return;
      }

      if (chars.length === 1) {
        await completeCoreSignup(interaction, pending.role, chars[0], true);
        return;
      }

      await interaction.reply({
        content: `✅ Aceptaste los términos. Ahora elige con qué personaje te inscribes como **${pending.role}**:`,
        components: [buildCharSelectMenu(chars, pending.role)],
        ephemeral: true,
      });
      return;
    }

    // ── Cancelar términos ──
    if (interaction.customId === 'core_terms_decline') {
      clearPendingSignup(interaction.user.id);
      await interaction.reply({
        embeds: [successEmbed('Inscripción cancelada', 'Puedes inscribirte en cualquier momento volviendo a hacer clic en un rol.')],
        ephemeral: true,
      });
      return;
    }

    // ── Inscripción por rol ──
    const match = interaction.customId.match(/^core_signup_(.+)$/);
    if (!match) return;

    const role = match[1];

    const chars = getCharacters(interaction.user.id);
    if (chars.length === 0) {
      await interaction.reply({
        embeds: [errorEmbed(
          'Sin personajes vinculados',
          'Necesitas vincular un personaje primero con `/vincular nombre realm` para inscribirte al core.',
        )],
        ephemeral: true,
      });
      return;
    }

    // Si no ha aceptado términos → mostrar reglas
    if (!hasAcceptedTerms(interaction.user.id)) {
      setPendingSignup(interaction.user.id, role);

      const termsEmbed = wowEmbed(
        '📜 Términos y Condiciones — Core Raid',
        CORE_TERMS_TEXT,
      );

      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('core_terms_accept')
          .setLabel('✅ Acepto los términos')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('core_terms_decline')
          .setLabel('Cancelar')
          .setStyle(ButtonStyle.Secondary),
      );

      await interaction.reply({
        embeds: [termsEmbed],
        components: [buttons],
        ephemeral: true,
      });
      return;
    }

    // Ya aceptó términos → flujo normal
    if (chars.length === 1) {
      await completeCoreSignup(interaction, role, chars[0], false);
      return;
    }

    await interaction.reply({
      content: `Tienes ${chars.length} personajes. Elige con cuál te inscribes como **${role}**:`,
      components: [buildCharSelectMenu(chars, role)],
      ephemeral: true,
    });
  },
};

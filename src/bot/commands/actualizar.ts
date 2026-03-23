import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { fetchCharacter } from '../../api/raiderio.js';
import { config } from '../../config.js';
import { WOW_CLASS_COLORS } from '../../utils/constants.js';
import { errorEmbed } from '../../utils/embeds.js';
import { getCharacters, upsertCharacter, type CharacterRow } from './vincular.js';
import { refreshCoreMessage } from '../../utils/core-embed.js';

export default {
  data: new SlashCommandBuilder()
    .setName('actualizar')
    .setDescription('Actualiza datos de tus personajes vinculados desde Raider.IO')
    .addStringOption((opt) =>
      opt.setName('nombre').setDescription('Nombre de un personaje especifico (si no, actualiza todos)').setRequired(false),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const specificName = interaction.options.getString('nombre');
    const chars = getCharacters(interaction.user.id);

    if (chars.length === 0) {
      await interaction.editReply({
        embeds: [errorEmbed('Sin personajes', 'No tienes personajes vinculados. Usa `/vincular nombre realm` primero.')],
      });
      return;
    }

    const toUpdate = specificName
      ? chars.filter((c) => c.wow_character.toLowerCase() === specificName.toLowerCase())
      : chars;

    if (toUpdate.length === 0) {
      await interaction.editReply({
        embeds: [errorEmbed('No encontrado', `No tienes un personaje llamado **${specificName}** vinculado.`)],
      });
      return;
    }

    const results: { char: CharacterRow; oldIlvl: number; newIlvl: number; oldRio: number; newRio: number; ok: boolean }[] = [];

    for (const c of toUpdate) {
      const profile = await fetchCharacter(c.wow_character, c.wow_realm, config.guild.region);
      if (profile) {
        const newIlvl = profile.gear?.item_level_equipped ?? 0;
        const newRio = profile.mythic_plus_scores_by_season?.[0]?.scores?.all ?? 0;
        const specName = profile.active_spec_name ?? c.wow_spec ?? 'Desconocido';
        const specRole = profile.active_spec_role ?? c.wow_role ?? 'DPS';

        upsertCharacter(
          interaction.user.id,
          profile.name,
          profile.realm,
          profile.class,
          specName,
          specRole,
          newIlvl,
          newRio,
        );

        results.push({ char: c, oldIlvl: c.ilvl, newIlvl, oldRio: c.rio_score, newRio, ok: true });
      } else {
        results.push({ char: c, oldIlvl: c.ilvl, newIlvl: c.ilvl, oldRio: c.rio_score, newRio: c.rio_score, ok: false });
      }
    }

    const arrow = (diff: number) => (diff > 0 ? `+${diff} ⬆` : diff < 0 ? `${diff} ⬇` : '=');

    const lines = results.map((r) => {
      if (!r.ok) return `**${r.char.wow_character}** - ${r.char.wow_realm}: Error al consultar Raider.IO`;
      const ilvlDiff = r.newIlvl - r.oldIlvl;
      const rioDiff = r.newRio - r.oldRio;
      return `**${r.char.wow_character}** - ${r.char.wow_realm}\n` +
        `  iLvl: ${r.newIlvl} (${arrow(ilvlDiff)}) | M+: ${r.newRio} (${arrow(rioDiff)})`;
    });

    const successCount = results.filter((r) => r.ok).length;
    const mainChar = results.find((r) => r.ok);
    const color = mainChar ? (WOW_CLASS_COLORS[mainChar.char.wow_class ?? ''] ?? 0xFF8000) : 0xFF8000;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`Personajes Actualizados (${successCount}/${toUpdate.length})`)
      .setDescription(lines.join('\n\n'))
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    if (interaction.guild && successCount > 0) {
      await refreshCoreMessage(interaction.guild).catch(() => {});
    }
  },
};

import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { fetchCharacter } from '../../api/raiderio.js';
import { getDb } from '../../db/database.js';
import { config } from '../../config.js';
import { EMBED_COLORS } from '../../utils/constants.js';
import { errorEmbed } from '../../utils/embeds.js';
import { upsertCharacter } from './vincular.js';
import { refreshCoreMessage } from '../../utils/core-embed.js';

interface CharacterRow {
  id: number;
  discord_id: string;
  wow_character: string;
  wow_realm: string;
  wow_class: string | null;
  wow_spec: string | null;
  wow_role: string | null;
  ilvl: number;
  rio_score: number;
  is_main: number;
}

export default {
  data: new SlashCommandBuilder()
    .setName('actualizar-todos')
    .setDescription('Actualiza ilvl y M+ de TODOS los personajes de la guild (solo admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const db = getDb();
    const allChars = db.prepare(
      `SELECT * FROM characters ORDER BY discord_id, is_main DESC, ilvl DESC`,
    ).all() as CharacterRow[];

    if (allChars.length === 0) {
      await interaction.editReply({
        embeds: [errorEmbed('Sin personajes', 'No hay personajes vinculados en la guild.')],
      });
      return;
    }

    let ok = 0;
    let fail = 0;
    const failedNames: string[] = [];

    for (const c of allChars) {
      const profile = await fetchCharacter(c.wow_character, c.wow_realm, config.guild.region);
      if (profile) {
        const newIlvl = profile.gear?.item_level_equipped ?? 0;
        const newRio = profile.mythic_plus_scores_by_season?.[0]?.scores?.all ?? 0;

        upsertCharacter(
          c.discord_id,
          profile.name,
          profile.realm,
          profile.class,
          profile.active_spec_name ?? '',
          profile.active_spec_role ?? '',
          newIlvl,
          newRio,
        );
        ok++;
      } else {
        fail++;
        if (failedNames.length < 10) {
          failedNames.push(`${c.wow_character}-${c.wow_realm}`);
        }
      }
    }

    const failLine = failedNames.length > 0
      ? `\n\n**Errores:** ${failedNames.join(', ')}${fail > 10 ? ` (+${fail - 10} mas)` : ''}`
      : '';

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.success)
      .setTitle('Actualizacion masiva completada')
      .setDescription(
        `**${ok}** personajes actualizados correctamente.\n` +
        `**${fail}** fallaron al consultar Raider.IO.${failLine}`,
      )
      .setFooter({ text: `Total: ${allChars.length} personajes` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    if (interaction.guild && ok > 0) {
      await refreshCoreMessage(interaction.guild).catch(() => {});
    }
  },
};

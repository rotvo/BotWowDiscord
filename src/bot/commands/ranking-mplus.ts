import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { fetchCharacter } from '../../api/raiderio.js';
import { config } from '../../config.js';
import { getDb } from '../../db/database.js';
import { EMBED_COLORS } from '../../utils/constants.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ranking-mplus')
    .setDescription('Leaderboard de M+ score de los miembros de la guild'),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const db = getDb();
    const characters = db.prepare(
      "SELECT id, discord_id, wow_character, wow_realm FROM characters WHERE wow_character IS NOT NULL AND wow_character != ''",
    ).all() as { id: number; discord_id: string; wow_character: string; wow_realm: string }[];

    if (characters.length === 0) {
      await interaction.editReply('No hay personajes registrados. Usa `/vincular` para agregar uno.');
      return;
    }

    const scores: { name: string; discordId: string; score: number; ilvl: number }[] = [];

    for (const c of characters.slice(0, 25)) {
      const profile = await fetchCharacter(c.wow_character, c.wow_realm, config.guild.region);
      if (profile) {
        const s = profile.mythic_plus_scores_by_season?.[0]?.scores?.all ?? 0;
        scores.push({
          name: profile.name,
          discordId: c.discord_id,
          score: s,
          ilvl: profile.gear?.item_level_equipped ?? 0,
        });
      }
    }

    scores.sort((a, b) => b.score - a.score);

    const medals = ['🥇', '🥈', '🥉'];
    const lines = scores.map((s, i) => {
      const medal = medals[i] ?? `**${i + 1}.**`;
      return `${medal} **${s.name}** (<@${s.discordId}>) — Score: **${s.score.toFixed(0)}** | iLvl: ${s.ilvl}`;
    });

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.wow)
      .setTitle(`Ranking M+ — ${config.guild.name}`)
      .setDescription(lines.join('\n') || 'Sin datos disponibles.')
      .setFooter({ text: `${scores.length} personajes` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

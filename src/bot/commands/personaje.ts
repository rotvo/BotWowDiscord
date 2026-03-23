import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { fetchCharacter } from '../../api/raiderio.js';
import { fetchBlizzardCharacter, isBlizzardConfigured } from '../../api/blizzard.js';
import { config } from '../../config.js';
import { WOW_CLASS_COLORS, EMBED_COLORS } from '../../utils/constants.js';

export default {
  data: new SlashCommandBuilder()
    .setName('personaje')
    .setDescription('Busca informacion de un personaje de WoW')
    .addStringOption((opt) =>
      opt.setName('nombre')
        .setDescription('Nombre del personaje')
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName('servidor')
        .setDescription('Servidor (default: servidor de la guild)')
        .setRequired(false),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const nombre = interaction.options.getString('nombre', true);
    const servidor = interaction.options.getString('servidor') ?? config.guild.realm;

    const rioData = await fetchCharacter(nombre, servidor, config.guild.region);

    let blizzData = null;
    if (isBlizzardConfigured()) {
      blizzData = await fetchBlizzardCharacter(nombre, servidor);
    }

    if (!rioData && !blizzData) {
      await interaction.editReply(`No se encontro el personaje **${nombre}-${servidor}**. Verifica el nombre y servidor.`);
      return;
    }

    const className = rioData?.class ?? blizzData?.character_class?.name ?? 'Unknown';
    const color = WOW_CLASS_COLORS[className] ?? EMBED_COLORS.wow;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${rioData?.name ?? nombre} — ${servidor}`)
      .setTimestamp();

    if (rioData?.thumbnail_url) embed.setThumbnail(rioData.thumbnail_url);
    if (rioData?.profile_url) embed.setURL(rioData.profile_url);

    const fields: { name: string; value: string; inline?: boolean }[] = [];

    fields.push(
      { name: 'Clase', value: className, inline: true },
      { name: 'Spec', value: rioData?.active_spec_name ?? blizzData?.active_spec?.name ?? 'N/A', inline: true },
      { name: 'Faccion', value: rioData?.faction ?? blizzData?.faction?.name ?? 'N/A', inline: true },
    );

    const ilvl = rioData?.gear?.item_level_equipped ?? blizzData?.equipped_item_level;
    if (ilvl) {
      fields.push({ name: 'Item Level', value: `${ilvl}`, inline: true });
    }

    if (rioData?.mythic_plus_scores_by_season?.[0]) {
      const scores = rioData.mythic_plus_scores_by_season[0].scores;
      fields.push({
        name: 'M+ Score',
        value: `**${scores.all.toFixed(0)}** (DPS: ${scores.dps.toFixed(0)} | Healer: ${scores.healer.toFixed(0)} | Tank: ${scores.tank.toFixed(0)})`,
        inline: false,
      });
    }

    if (rioData?.mythic_plus_best_runs?.length) {
      const runs = rioData.mythic_plus_best_runs
        .slice(0, 8)
        .map((r) => `**${r.short_name}** +${r.mythic_level} (${'★'.repeat(r.num_keystone_upgrades)}) — ${r.score.toFixed(0)}`)
        .join('\n');
      fields.push({ name: 'Mejores M+ Runs', value: runs });
    }

    if (rioData?.raid_progression) {
      const raids = Object.entries(rioData.raid_progression)
        .map(([name, p]) => `**${name}:** ${p.summary}`)
        .join('\n');
      if (raids) fields.push({ name: 'Raid Progress', value: raids });
    }

    embed.addFields(fields);
    await interaction.editReply({ embeds: [embed] });
  },
};

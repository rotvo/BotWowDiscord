import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { fetchCharacter, type RaiderIOProfile } from '../../api/raiderio.js';
import { config } from '../../config.js';
import { getDb } from '../../db/database.js';
import { EMBED_COLORS } from '../../utils/constants.js';

export default {
  data: new SlashCommandBuilder()
    .setName('guild-progress')
    .setDescription('Muestra el progreso de raid de los miembros de la guild'),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const db = getDb();
    const characters = db.prepare(
      "SELECT wow_character, wow_realm FROM characters WHERE wow_character IS NOT NULL AND wow_character != '' AND is_main = 1",
    ).all() as { wow_character: string; wow_realm: string }[];

    if (characters.length === 0) {
      await interaction.editReply('No hay personajes registrados. Usa `/vincular` para agregar uno.');
      return;
    }

    const profiles: RaiderIOProfile[] = [];
    for (const c of characters.slice(0, 20)) {
      const profile = await fetchCharacter(c.wow_character, c.wow_realm, config.guild.region);
      if (profile) profiles.push(profile);
    }

    if (profiles.length === 0) {
      await interaction.editReply('No se pudo obtener datos de ningun miembro.');
      return;
    }

    const allRaids = new Set<string>();
    for (const p of profiles) {
      if (p.raid_progression) {
        Object.keys(p.raid_progression).forEach((r) => allRaids.add(r));
      }
    }

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.wow)
      .setTitle(`Progreso de Raid — ${config.guild.name}`)
      .setDescription(`Datos de ${profiles.length} miembro(s) (personajes principales)`)
      .setTimestamp();

    for (const raidName of allRaids) {
      const lines: string[] = [];
      for (const p of profiles) {
        const prog = p.raid_progression?.[raidName];
        if (prog) {
          lines.push(`**${p.name}:** ${prog.summary}`);
        }
      }
      if (lines.length > 0) {
        embed.addFields({ name: raidName, value: lines.join('\n') });
      }
    }

    await interaction.editReply({ embeds: [embed] });
  },
};

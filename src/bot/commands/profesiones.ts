import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { getDb } from '../../db/database.js';
import { WOW_PROFESSIONS, WOW_PROFESSION_COLORS, EMBED_COLORS } from '../../utils/constants.js';
import { wowEmbed, errorEmbed, successEmbed } from '../../utils/embeds.js';
import { getCharacters, getMainCharacter, type CharacterRow } from './vincular.js';

const profChoices = WOW_PROFESSIONS.map((p) => ({ name: p, value: p }));

export default {
  data: new SlashCommandBuilder()
    .setName('profesiones')
    .setDescription('Gestiona y consulta profesiones de la guild')
    .addSubcommand((sub) =>
      sub.setName('listar').setDescription('Lista todas las profesiones y cuantos miembros tienen cada una'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('buscar')
        .setDescription('Busca quien tiene una profesion especifica')
        .addStringOption((opt) =>
          opt
            .setName('profesion')
            .setDescription('La profesion a buscar')
            .setRequired(true)
            .addChoices(...profChoices),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('registrar')
        .setDescription('Registra una profesion en uno de tus personajes')
        .addStringOption((opt) =>
          opt
            .setName('profesion')
            .setDescription('Tu profesion')
            .setRequired(true)
            .addChoices(...profChoices),
        )
        .addStringOption((opt) =>
          opt.setName('personaje').setDescription('Nombre del personaje (si no, usa tu main)').setRequired(false),
        )
        .addStringOption((opt) =>
          opt.setName('especializacion').setDescription('Tu especializacion (ej: Potion Master, Armorsmith)').setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt.setName('nivel').setDescription('Tu nivel de skill (1-100)').setMinValue(1).setMaxValue(100).setRequired(false),
        )
        .addStringOption((opt) =>
          opt.setName('items').setDescription('Items notables que puedes craftear').setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('mias').setDescription('Muestra tus profesiones registradas por personaje'),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'listar') {
      await handleListar(interaction);
    } else if (sub === 'buscar') {
      await handleBuscar(interaction);
    } else if (sub === 'registrar') {
      await handleRegistrar(interaction);
    } else if (sub === 'mias') {
      await handleMias(interaction);
    }
  },
};

async function handleListar(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT profession, COUNT(*) as count
       FROM member_professions
       GROUP BY profession
       ORDER BY count DESC`,
    )
    .all() as { profession: string; count: number }[];

  if (rows.length === 0) {
    const embed = wowEmbed(
      'Profesiones de la Guild',
      'Nadie ha registrado profesiones todavia.\nUsa `/profesiones registrar` para ser el primero.',
    );
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const lines = rows.map((r) => `**${r.profession}** — ${r.count} registro${r.count === 1 ? '' : 's'}`);

  const totalRegistered = rows.reduce((sum, r) => sum + r.count, 0);
  lines.push('', `*Total: ${totalRegistered} registros en ${rows.length} profesiones*`);

  const embed = wowEmbed('Profesiones de la Guild', lines.join('\n'));
  await interaction.editReply({ embeds: [embed] });
}

async function handleBuscar(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const profession = interaction.options.getString('profesion', true);
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT mp.discord_id, mp.specialization, mp.skill_level, mp.notable_crafts, mp.character_id,
              c.wow_character, c.wow_realm
       FROM member_professions mp
       LEFT JOIN characters c ON mp.character_id = c.id
       WHERE mp.profession = ?
       ORDER BY mp.skill_level DESC`,
    )
    .all(profession) as {
    discord_id: string;
    specialization: string | null;
    skill_level: number;
    notable_crafts: string | null;
    character_id: number;
    wow_character: string | null;
    wow_realm: string | null;
  }[];

  if (rows.length === 0) {
    const embed = errorEmbed(
      'Sin Resultados',
      `Nadie tiene **${profession}** registrada.\nUsa \`/profesiones registrar\` para registrarte.`,
    );
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const lines = rows.map((r) => {
    const charName = r.wow_character ? `**${r.wow_character}**-${r.wow_realm}` : '';
    let line = `<@${r.discord_id}>`;
    if (charName) line += ` (${charName})`;
    if (r.specialization) line += ` — *${r.specialization}*`;
    if (r.skill_level > 0) line += ` (Nivel ${r.skill_level})`;
    if (r.notable_crafts) line += `\n  Craftea: ${r.notable_crafts}`;
    return line;
  });

  const color = WOW_PROFESSION_COLORS[profession] ?? EMBED_COLORS.wow;
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${profession} — ${rows.length} registro${rows.length === 1 ? '' : 's'}`)
    .setDescription(lines.join('\n'))
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleRegistrar(interaction: ChatInputCommandInteraction): Promise<void> {
  const profession = interaction.options.getString('profesion', true);
  const charName = interaction.options.getString('personaje');
  const specialization = interaction.options.getString('especializacion') ?? null;
  const skillLevel = interaction.options.getInteger('nivel') ?? 0;
  const notableCrafts = interaction.options.getString('items') ?? null;

  let character: CharacterRow | null = null;

  if (charName) {
    const chars = getCharacters(interaction.user.id);
    character = chars.find((c) => c.wow_character.toLowerCase() === charName.toLowerCase()) ?? null;
    if (!character) {
      await interaction.reply({
        embeds: [errorEmbed('Personaje no encontrado', `No tienes un personaje llamado **${charName}** vinculado.\nUsa \`/mis-personajes\` para ver tus personajes.`)],
        ephemeral: true,
      });
      return;
    }
  } else {
    character = getMainCharacter(interaction.user.id);
    if (!character) {
      await interaction.reply({
        embeds: [errorEmbed('Sin personajes', 'Vincula un personaje con `/vincular nombre realm` primero, o especifica el nombre con la opcion `personaje`.')],
        ephemeral: true,
      });
      return;
    }
  }

  const db = getDb();
  db.prepare(
    `INSERT INTO member_professions (discord_id, profession, specialization, skill_level, notable_crafts, character_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(discord_id, profession)
     DO UPDATE SET specialization = excluded.specialization,
                   skill_level = excluded.skill_level,
                   notable_crafts = excluded.notable_crafts,
                   character_id = excluded.character_id,
                   updated_at = datetime('now')`,
  ).run(interaction.user.id, profession, specialization, skillLevel, notableCrafts, character.id);

  let desc = `Registrada **${profession}** en **${character.wow_character}**`;
  if (specialization) desc += `\nEspecializacion: *${specialization}*`;
  if (skillLevel > 0) desc += `\nNivel: ${skillLevel}`;
  if (notableCrafts) desc += `\nItems: ${notableCrafts}`;

  const embed = successEmbed('Profesion Registrada', desc);
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleMias(interaction: ChatInputCommandInteraction): Promise<void> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT mp.profession, mp.specialization, mp.skill_level, mp.notable_crafts, mp.character_id,
              c.wow_character, c.wow_realm
       FROM member_professions mp
       LEFT JOIN characters c ON mp.character_id = c.id
       WHERE mp.discord_id = ?
       ORDER BY c.wow_character, mp.profession`,
    )
    .all(interaction.user.id) as {
    profession: string;
    specialization: string | null;
    skill_level: number;
    notable_crafts: string | null;
    character_id: number;
    wow_character: string | null;
    wow_realm: string | null;
  }[];

  if (rows.length === 0) {
    const embed = wowEmbed(
      'Mis Profesiones',
      'No tienes profesiones registradas.\nUsa `/profesiones registrar` para agregar una.',
    );
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  // Group by character
  const grouped = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.wow_character ? `${r.wow_character}-${r.wow_realm}` : 'Sin personaje';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }

  const lines: string[] = [];
  for (const [charName, profs] of grouped) {
    lines.push(`**${charName}:**`);
    for (const r of profs) {
      let line = `  ${r.profession}`;
      if (r.specialization) line += ` — *${r.specialization}*`;
      if (r.skill_level > 0) line += ` (Nivel ${r.skill_level})`;
      if (r.notable_crafts) line += `\n    Craftea: ${r.notable_crafts}`;
      lines.push(line);
    }
    lines.push('');
  }

  const embed = wowEmbed('Mis Profesiones', lines.join('\n'));
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

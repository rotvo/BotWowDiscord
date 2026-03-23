import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
} from 'discord.js';
import { getDb } from '../../db/database.js';
import { EMBED_COLORS, MPLUS_DUNGEONS } from '../../utils/constants.js';
import { getMainCharacter } from './vincular.js';
import { errorEmbed } from '../../utils/embeds.js';
import { findChannelByName } from '../../utils/channels.js';

export default {
  data: new SlashCommandBuilder()
    .setName('buscar-key')
    .setDescription('Busca grupo para una M+')
    .addStringOption((opt) =>
      opt.setName('dungeon')
        .setDescription('Nombre del dungeon')
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addIntegerOption((opt) =>
      opt.setName('nivel')
        .setDescription('Nivel de la key (+2 a +20)')
        .setRequired(true)
        .addChoices(
          ...Array.from({ length: 19 }, (_, i) => ({ name: `+${i + 2}`, value: i + 2 })),
        ),
    )
    .addStringOption((opt) =>
      opt.setName('rol')
        .setDescription('Tu rol')
        .setRequired(true)
        .addChoices(
          { name: 'Tank', value: 'Tank' },
          { name: 'Healer', value: 'Healer' },
          { name: 'DPS', value: 'DPS' },
        ),
    )
    .addStringOption((opt) =>
      opt.setName('nota')
        .setDescription('Nota adicional (ej: necesitamos healer)')
        .setRequired(false),
    )
    .addIntegerOption((opt) =>
      opt.setName('ilvl-minimo')
        .setDescription('Item level minimo para unirse (opcional)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(700),
    ),
  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused();
    const filtered = (MPLUS_DUNGEONS as readonly string[])
      .filter((d) => d.toLowerCase().includes(focused.toLowerCase()))
      .slice(0, 25)
      .map((d) => ({ name: d, value: d }));
    await interaction.respond(filtered);
  },
  async execute(interaction: ChatInputCommandInteraction) {
    const dungeon = interaction.options.getString('dungeon', true);
    const nivel = interaction.options.getInteger('nivel', true);
    const rol = interaction.options.getString('rol', true);
    const nota = interaction.options.getString('nota') ?? '';
    const minIlvl = interaction.options.getInteger('ilvl-minimo') ?? 0;

    const character = getMainCharacter(interaction.user.id);
    if (!character) {
      await interaction.reply({
        embeds: [errorEmbed('Sin personajes', 'Vincula un personaje con `/vincular nombre realm` antes de crear un grupo.')],
        ephemeral: true,
      });
      return;
    }

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO mplus_groups (leader_id, dungeon, key_level, description, status, min_ilvl)
      VALUES (?, ?, ?, ?, 'open', ?)
    `).run(interaction.user.id, dungeon, nivel, nota, minIlvl);

    const groupId = result.lastInsertRowid as number;

    db.prepare('INSERT INTO mplus_signups (group_id, discord_id, role, wow_class, wow_spec, ilvl, character_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(groupId, interaction.user.id, rol, character.wow_class, character.wow_spec, character.ilvl, character.id);

    const leaderTag = `${interaction.user} (${character.wow_character} - ${character.wow_class} ${character.wow_spec} ${character.ilvl} ilvl)`;
    const ilvlLine = minIlvl > 0 ? `**iLvl Minimo:** ${minIlvl}\n` : '';

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.wow)
      .setTitle(`M+ ${dungeon} +${nivel}`)
      .setDescription(
        [
          nota ? `${nota}\n` : '',
          `**Lider:** ${leaderTag}`,
          ilvlLine,
          '**Grupo:**',
          `🛡️ Tank: ${rol === 'Tank' ? leaderTag : '*buscando...*'}`,
          `💚 Healer: ${rol === 'Healer' ? leaderTag : '*buscando...*'}`,
          `⚔️ DPS 1: ${rol === 'DPS' ? leaderTag : '*buscando...*'}`,
          `⚔️ DPS 2: *buscando...*`,
          `⚔️ DPS 3: *buscando...*`,
        ].join('\n'),
      )
      .setFooter({ text: `Grupo ID: ${groupId}` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`mplus_join_tank_${groupId}`)
        .setLabel('Tank')
        .setEmoji('🛡️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`mplus_join_healer_${groupId}`)
        .setLabel('Healer')
        .setEmoji('💚')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`mplus_join_dps_${groupId}`)
        .setLabel('DPS')
        .setEmoji('⚔️')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`mplus_leave_${groupId}`)
        .setLabel('Salir')
        .setStyle(ButtonStyle.Secondary),
    );

    const mplusChannel = findChannelByName(interaction.guild!, 'buscar-grupo');
    const isText = mplusChannel?.type === ChannelType.GuildText;
    const targetChannel = isText ? mplusChannel : (interaction.channel && 'send' in interaction.channel ? interaction.channel : null);
    if (!targetChannel || !('send' in targetChannel)) {
      await interaction.reply({ content: 'No se encontro canal.', ephemeral: true });
      return;
    }

    const msg = await (targetChannel as import('discord.js').TextChannel).send({ embeds: [embed], components: [row] });

    db.prepare('UPDATE mplus_groups SET message_id = ?, channel_id = ? WHERE id = ?')
      .run(msg.id, msg.channelId, groupId);

    const mplusRole = interaction.guild?.roles.cache.find((r) => r.name === 'Miticas+');
    if (mplusRole) {
      await (targetChannel as import('discord.js').TextChannel).send(`${mplusRole} Grupo de M+ disponible!`);
    }

    await interaction.reply({ content: `Grupo creado en ${targetChannel}`, ephemeral: true });
  },
};

import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { fetchCharacter } from '../../api/raiderio.js';
import { getDb } from '../../db/database.js';
import { findChannelByName } from '../../utils/channels.js';
import { config } from '../../config.js';
import { WOW_CLASS_COLORS, ROLE_TYPES } from '../../utils/constants.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { refreshCoreMessage } from '../../utils/core-embed.js';

export interface CharacterRow {
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

export function upsertCharacter(
  discordId: string,
  character: string,
  realm: string,
  wowClass: string,
  spec: string,
  role: string,
  ilvl: number,
  rioScore: number,
): CharacterRow {
  const db = getDb();

  const existing = db.prepare(
    `SELECT COUNT(*) as cnt FROM characters WHERE discord_id = ?`,
  ).get(discordId) as { cnt: number };
  const isFirst = existing.cnt === 0;

  db.prepare(
    `INSERT INTO characters (discord_id, wow_character, wow_realm, wow_class, wow_spec, wow_role, ilvl, rio_score, is_main, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(discord_id, wow_character, wow_realm)
     DO UPDATE SET wow_class = excluded.wow_class,
                   wow_spec = excluded.wow_spec,
                   wow_role = excluded.wow_role,
                   ilvl = excluded.ilvl,
                   rio_score = excluded.rio_score,
                   updated_at = datetime('now')`,
  ).run(discordId, character, realm, wowClass, spec, role, ilvl, rioScore, isFirst ? 1 : 0);

  return db.prepare(
    `SELECT * FROM characters WHERE discord_id = ? AND wow_character = ? AND wow_realm = ?`,
  ).get(discordId, character, realm) as CharacterRow;
}

export function getCharacters(discordId: string): CharacterRow[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM characters WHERE discord_id = ? ORDER BY is_main DESC, ilvl DESC`,
  ).all(discordId) as CharacterRow[];
}

export function getMainCharacter(discordId: string): CharacterRow | null {
  const db = getDb();
  const row = db.prepare(
    `SELECT * FROM characters WHERE discord_id = ? ORDER BY is_main DESC, ilvl DESC LIMIT 1`,
  ).get(discordId) as CharacterRow | undefined;
  return row ?? null;
}

export function getCharacterById(id: number): CharacterRow | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM characters WHERE id = ?`).get(id) as CharacterRow | undefined;
  return row ?? null;
}

export function setMainCharacter(discordId: string, characterId: number): void {
  const db = getDb();
  db.prepare(`UPDATE characters SET is_main = 0 WHERE discord_id = ?`).run(discordId);
  db.prepare(`UPDATE characters SET is_main = 1 WHERE id = ? AND discord_id = ?`).run(characterId, discordId);
}

export function deleteCharacter(characterId: number, discordId: string): boolean {
  const db = getDb();
  const result = db.prepare(`DELETE FROM characters WHERE id = ? AND discord_id = ?`).run(characterId, discordId);
  if (result.changes > 0) {
    const remaining = getCharacters(discordId);
    if (remaining.length > 0 && !remaining.some((c) => c.is_main)) {
      db.prepare(`UPDATE characters SET is_main = 1 WHERE id = ?`).run(remaining[0].id);
    }
    return true;
  }
  return false;
}

export function formatCharacterLabel(c: CharacterRow): string {
  return `${c.wow_character}-${c.wow_realm} (${c.wow_class ?? '?'} ${c.wow_spec ?? '?'} - ${c.ilvl} ilvl)`;
}

export default {
  data: new SlashCommandBuilder()
    .setName('vincular')
    .setDescription('Vincula un personaje de WoW a tu cuenta de Discord')
    .addStringOption((opt) =>
      opt.setName('nombre').setDescription('Nombre de tu personaje').setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName('realm')
        .setDescription('Servidor (ej: Wyrmrest Accord, Ragnaros)')
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName('main')
        .setDescription('¿Marcar como personaje principal?')
        .setRequired(false)
        .addChoices(
          { name: 'Sí', value: 'true' },
          { name: 'No', value: 'false' },
        ),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('nombre', true);
    const realm = interaction.options.getString('realm', true);
    const setAsMain = interaction.options.getString('main') === 'true';
    const region = config.guild.region;

    const profile = await fetchCharacter(name, realm, region);
    if (!profile) {
      await interaction.editReply({
        embeds: [errorEmbed('Personaje no encontrado', `No se encontro **${name}** en **${realm}** (${region}).\nVerifica el nombre y servidor.`)],
      });
      return;
    }

    const ilvl = profile.gear?.item_level_equipped ?? 0;
    const rioScore = profile.mythic_plus_scores_by_season?.[0]?.scores?.all ?? 0;
    const activeSpec = profile.active_spec_name ?? 'Desconocido';
    const activeRole = profile.active_spec_role ?? 'DPS';

    const charRow = upsertCharacter(
      interaction.user.id,
      profile.name,
      profile.realm,
      profile.class,
      activeSpec,
      activeRole,
      ilvl,
      rioScore,
    );

    if (setAsMain) {
      setMainCharacter(interaction.user.id, charRow.id);
    }

    // Ensure member row exists
    const db = getDb();
    db.prepare(
      `INSERT OR IGNORE INTO members (discord_id, discord_name) VALUES (?, ?)`,
    ).run(interaction.user.id, interaction.user.tag);

    const allChars = getCharacters(interaction.user.id);
    const mainTag = charRow.is_main || setAsMain ? ' (Main)' : '';

    const color = WOW_CLASS_COLORS[profile.class] ?? 0xFF8000;
    const faction = profile.faction ?? 'Desconocida';

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`Personaje Vinculado${mainTag}`)
      .setThumbnail(profile.thumbnail_url)
      .addFields(
        { name: 'Personaje', value: `**${profile.name ?? ''}** - ${profile.realm ?? '—'}`, inline: true },
        { name: 'Clase', value: String([profile.class, activeSpec].filter(Boolean).join(' ') || '—'), inline: true },
        { name: 'Rol', value: String(activeRole), inline: true },
        { name: 'Item Level', value: String(ilvl), inline: true },
        { name: 'M+ Score', value: String(rioScore), inline: true },
        { name: 'Faccion', value: String(faction), inline: true },
        { name: 'Total personajes', value: String(allChars.length), inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    if (interaction.guild) {
      const member = interaction.guild.members.cache.get(interaction.user.id)
        ?? await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

      if (member) {
        const invitadoRole = interaction.guild.roles.cache.find((r) => r.name === 'Invitado');
        const miembroRole = interaction.guild.roles.cache.find((r) => r.name === 'Miembro');
        if (invitadoRole && miembroRole && member.roles.cache.has(invitadoRole.id) && !member.roles.cache.has(miembroRole.id)) {
          try {
            await member.roles.add(miembroRole, 'Auto-promocion: vinculó personaje');
            await member.roles.remove(invitadoRole, 'Auto-promocion: ya es Miembro');
          } catch { /* perms */ }
        }

        const classRole = interaction.guild.roles.cache.find((r) => r.name === profile.class);
        if (classRole && !member.roles.cache.has(classRole.id)) {
          try { await member.roles.add(classRole, `Auto-rol: vinculó ${profile.class}`); } catch { /* perms */ }
        }

        const MELEE_SPECS = new Set([
          'Arms', 'Fury', 'Protection', 'Retribution', 'Feral', 'Guardian',
          'Brewmaster', 'Windwalker', 'Assassination', 'Outlaw', 'Subtlety',
          'Enhancement', 'Havoc', 'Vengeance', 'Unholy', 'Frost', 'Blood',
          'Survival',
        ]);
        const specRoleMap: Record<string, string> = { HEALING: 'Healer', TANK: 'Tank' };
        let specRoleName = specRoleMap[profile.active_spec_role] ?? null;
        if (profile.active_spec_role === 'DPS') {
          specRoleName = MELEE_SPECS.has(profile.active_spec_name) ? 'DPS Melee' : 'DPS Ranged';
        }
        if (specRoleName) {
          const hasAnyRole = ROLE_TYPES.some((rt) => member.roles.cache.find((r) => r.name === rt));
          if (!hasAnyRole) {
            const discordRole = interaction.guild.roles.cache.find((r) => r.name === specRoleName);
            if (discordRole) {
              try { await member.roles.add(discordRole, `Auto-rol: vinculó spec ${profile.active_spec_name}`); } catch { /* perms */ }
            }
          }
        }
      }

      await refreshCoreMessage(interaction.guild).catch(() => {});

      const regChannel = findChannelByName(interaction.guild, 'nuevos-personajes');
      if (regChannel?.isTextBased()) {
        const pubEmbed = new EmbedBuilder()
          .setColor(color)
          .setAuthor({
            name: interaction.user.displayName,
            iconURL: interaction.user.displayAvatarURL({ size: 64 }),
          })
          .setTitle(`${profile.name} - ${profile.realm}`)
          .setThumbnail(profile.thumbnail_url)
          .addFields(
            { name: 'Clase', value: String([profile.class, profile.active_spec_name].filter(Boolean).join(' ') || '—'), inline: true },
            { name: 'Rol', value: String(profile.active_spec_role ?? '—'), inline: true },
            { name: 'Item Level', value: String(ilvl ?? '—'), inline: true },
            { name: 'M+ Score', value: String(rioScore ?? '—'), inline: true },
            { name: 'Faccion', value: String(profile.faction ?? '—'), inline: true },
          )
          .setFooter({ text: charRow.is_main || setAsMain ? 'Personaje Principal' : 'Alt' })
          .setTimestamp();
        try { await regChannel.send({ embeds: [pubEmbed] }); } catch { /* perms */ }
      }
    }
  },
};

export const WOW_CLASS_COLORS: Record<string, number> = {
  'Death Knight': 0xC41E3A,
  'Demon Hunter': 0xA330C9,
  'Druid':        0xFF7C0A,
  'Evoker':       0x33937F,
  'Hunter':       0xAAD372,
  'Mage':         0x3FC7EB,
  'Monk':         0x00FF98,
  'Paladin':      0xF48CBA,
  'Priest':       0xFFFFFF,
  'Rogue':        0xFFF468,
  'Shaman':       0x0070DD,
  'Warlock':      0x8788EE,
  'Warrior':      0xC69B6D,
};

export const WOW_CLASSES = Object.keys(WOW_CLASS_COLORS);

export const ROLE_TYPES = ['Tank', 'Healer', 'DPS Melee', 'DPS Ranged'] as const;

export const ACTIVITY_TYPES = ['Raids', 'Miticas+', 'PvP'] as const;

export const GUILD_RANKS = [
  'Guild Master',
  'Oficial',
  'Raider',
  'Trial',
  'Miembro',
  'Invitado',
] as const;

/** Raids y Miticas+ se asignan en el onboarding; el bot menciona @Raids y @Miticas+ para avisos. Ya no hay botones de notificación en #roles. */
export const NOTIFICATION_ROLES: readonly string[] = [];

/** Reinos WoW (Americas) para autocompletado en /vincular. Slugs en minúsculas como en Raider.IO. */
export const WOW_REALMS = [
  'Aegwynn', 'Alterac Mountains', 'Antonidas', 'Anvilmar', 'Area 52', 'Arthas', 'Azjol-Nerub',
  'Azralon', 'Blackrock', 'Bleeding Hollow', 'Bonechewer', 'Burning Blade', 'Cenarius',
  'Dalaran', 'Dawnbringer', 'Destromath', 'Dragonblight', 'Drakkari', 'Durotan', 'Eitrigg',
  'Emerald Dream', 'Frostwolf', 'Gallywix', 'Garrosh', 'Goldrinn', 'Gorefiend', 'Illidan',
  'Kel Thuzad', 'Khaz Modan', 'Kilrogg', 'Krasus', 'Lightnings Blade', 'Madmortem', 'Malfurion',
  'Mal Ganis', 'Medivh', 'Moon Guard', 'Nemesis', 'Onyxia', 'Quel Thalas', 'Ragnaros', 'Rexxar',
  'Runetotem', 'Sargeras', 'Shuhalo', 'Silvermoon', 'Sisters of Elune', 'Skullcrusher',
  'Spinebreaker', 'Stormrage', 'Tanaris', 'Teldrassil', 'Terokkar', 'Thrall', 'Thunderlord',
  'Tichondrius', 'Tol Barad', 'Uldum', 'Undermine', 'Warsong', 'Wyrmrest Accord', 'Zul jin',
] as const;

/** Mazmorras M+ para autocompletado en /buscar-key. */
export const MPLUS_DUNGEONS = [
  'Algeth\'ar Academy',
  'Magister\'s Terrace',
  'Maisara Caverns',
  'Midnight Dungeons',
  'Nexus-Point Xenas',
  'Pit of Saron',
  'Seat of the Triumvirate',
  'Skyreach',
  'Windrunner Spire',
] as const;

export const WOW_PROFESSIONS_CRAFTING = [
  'Alquimia', 'Herreria', 'Encantamiento', 'Ingenieria',
  'Inscripcion', 'Joyeria', 'Peleteria', 'Sastreria',
] as const;

export const WOW_PROFESSIONS_GATHERING = [
  'Herboristeria', 'Mineria', 'Desuello',
] as const;

export const WOW_PROFESSIONS_SECONDARY = [
  'Cocina', 'Pesca',
] as const;

export const WOW_PROFESSIONS: readonly string[] = [
  ...WOW_PROFESSIONS_CRAFTING,
  ...WOW_PROFESSIONS_GATHERING,
  ...WOW_PROFESSIONS_SECONDARY,
];

export const WOW_PROFESSION_COLORS: Record<string, number> = {
  'Alquimia':      0x2ECC71,
  'Herreria':      0x7F8C8D,
  'Encantamiento': 0x9B59B6,
  'Ingenieria':    0xE67E22,
  'Inscripcion':   0xF39C12,
  'Joyeria':       0xE74C3C,
  'Peleteria':     0x8D6E63,
  'Sastreria':     0xAD1457,
  'Herboristeria': 0x27AE60,
  'Mineria':       0x95A5A6,
  'Desuello':      0xD35400,
  'Cocina':        0xE74C3C,
  'Pesca':         0x3498DB,
};

export const EMBED_COLORS = {
  primary: 0x5865F2,
  success: 0x57F287,
  warning: 0xFEE75C,
  danger:  0xED4245,
  info:    0x5865F2,
  wow:     0xFF8000,
} as const;

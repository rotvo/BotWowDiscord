/**
 * Mapeo completo de buffs, debuffs, utilidades y tier tokens para WoW: The War Within.
 * Basado en la plantilla de Raid Roster Template.
 * Nombres de habilidad en inglés, descripciones en español.
 */

export interface RaidBuff {
  id: string;
  name: string;
  description: string;
  providedBy: string[];
  category: 'buff' | 'debuff' | 'utility';
  icon: string;
}

// ═══════════════════════════════════════════════════════
//  MAJOR BUFFS & DEBUFFS
// ═══════════════════════════════════════════════════════

export const RAID_BUFFS: RaidBuff[] = [
  {
    id: 'arcane_intellect',
    name: 'Arcane Intellect',
    description: '+5% Intelecto',
    providedBy: ['Mage'],
    category: 'buff',
    icon: '🔮',
  },
  {
    id: 'battle_shout',
    name: 'Battle Shout',
    description: '+5% Poder de Ataque',
    providedBy: ['Warrior'],
    category: 'buff',
    icon: '💪',
  },
  {
    id: 'fortitude',
    name: 'Power Word: Fortitude',
    description: '+5% Aguante',
    providedBy: ['Priest'],
    category: 'buff',
    icon: '💛',
  },
  {
    id: 'devotion_aura',
    name: 'Devotion Aura',
    description: '-3% Daño recibido por el raid',
    providedBy: ['Paladin'],
    category: 'buff',
    icon: '✨',
  },
  {
    id: 'mystic_touch',
    name: 'Mystic Touch',
    description: '+5% Daño Físico recibido por enemigos',
    providedBy: ['Monk'],
    category: 'debuff',
    icon: '👊',
  },
  {
    id: 'chaos_brand',
    name: 'Chaos Brand',
    description: '+3% Daño Mágico recibido por enemigos',
    providedBy: ['Demon Hunter'],
    category: 'debuff',
    icon: '🔥',
  },
  {
    id: 'mark_of_the_wild',
    name: 'Mark of the Wild',
    description: '+3% Versatilidad',
    providedBy: ['Druid'],
    category: 'buff',
    icon: '🌿',
  },
  {
    id: 'hunters_mark',
    name: "Hunter's Mark",
    description: '+5% Daño recibido por el objetivo',
    providedBy: ['Hunter'],
    category: 'debuff',
    icon: '🎯',
  },
  {
    id: 'skyfury',
    name: 'Skyfury',
    description: '+2% Maestría y 20% prob. de golpe extra en ataques automáticos',
    providedBy: ['Shaman'],
    category: 'buff',
    icon: '⚡',
  },
  {
    id: 'blessing_of_the_bronze',
    name: 'Blessing of the Bronze',
    description: '-15% CD de habilidades de movimiento',
    providedBy: ['Evoker'],
    category: 'buff',
    icon: '🐉',
  },

  // ═══════════════════════════════════════════════════════
  //  UTILIDADES
  // ═══════════════════════════════════════════════════════

  {
    id: 'bloodlust',
    name: 'Bloodlust / Heroism',
    description: '+30% Celeridad por 40s (burst)',
    providedBy: ['Shaman', 'Mage', 'Hunter', 'Evoker'],
    category: 'utility',
    icon: '🔴',
  },
  {
    id: 'battle_res',
    name: 'Combat Res',
    description: 'Revivir aliados durante el combate',
    providedBy: ['Druid', 'Death Knight', 'Warlock', 'Paladin'],
    category: 'utility',
    icon: '💀',
  },
  {
    id: 'burst_move_speed',
    name: 'Stampeding Roar',
    description: '+60% Velocidad de movimiento grupal',
    providedBy: ['Druid'],
    category: 'utility',
    icon: '🐻',
  },
  {
    id: 'lock_stuff',
    name: 'Warlock Stuff (HS, Gate, Curse)',
    description: 'Piedras de Salud, Portal Demoníaco y Maldiciones',
    providedBy: ['Warlock'],
    category: 'utility',
    icon: '💚',
  },
  {
    id: 'innervate',
    name: 'Innervate',
    description: 'Restauración de maná a un sanador',
    providedBy: ['Druid'],
    category: 'utility',
    icon: '💧',
  },
  {
    id: 'blessing_of_protection',
    name: 'Blessing of Protection',
    description: 'Inmunidad temporal a daño físico para un aliado',
    providedBy: ['Paladin'],
    category: 'utility',
    icon: '🙏',
  },
  {
    id: 'rallying_cry',
    name: 'Rallying Cry',
    description: '+15% Vida máxima temporal para todo el raid',
    providedBy: ['Warrior'],
    category: 'utility',
    icon: '📣',
  },
  {
    id: 'darkness',
    name: 'Darkness',
    description: '20% prob. de evitar ataques en un área',
    providedBy: ['Demon Hunter'],
    category: 'utility',
    icon: '🌑',
  },
  {
    id: 'immunities',
    name: 'Immunities',
    description: 'Inmunidades personales completas',
    providedBy: ['Paladin', 'Mage', 'Hunter', 'Rogue'],
    category: 'utility',
    icon: '🛡️',
  },
  {
    id: 'power_infusion',
    name: 'Power Infusion',
    description: '+25% Celeridad a 1 aliado',
    providedBy: ['Priest'],
    category: 'utility',
    icon: '⚡',
  },
  {
    id: 'blessing_of_spellwarding',
    name: 'Blessing of Spellwarding',
    description: 'Inmunidad temporal a daño mágico para un aliado',
    providedBy: ['Paladin'],
    category: 'utility',
    icon: '🔰',
  },
];

// ═══════════════════════════════════════════════════════
//  TIER TOKENS (The War Within — por tipo de armadura)
// ═══════════════════════════════════════════════════════

export interface TierToken {
  name: string;
  armorType: string;
  classes: string[];
  icon: string;
}

export const TIER_TOKENS: TierToken[] = [
  {
    name: 'Cloth',
    armorType: 'Tela',
    classes: ['Mage', 'Priest', 'Warlock'],
    icon: '🧵',
  },
  {
    name: 'Leather',
    armorType: 'Cuero',
    classes: ['Demon Hunter', 'Druid', 'Monk', 'Rogue'],
    icon: '🦊',
  },
  {
    name: 'Mail',
    armorType: 'Malla',
    classes: ['Evoker', 'Hunter', 'Shaman'],
    icon: '⛓️',
  },
  {
    name: 'Plate',
    armorType: 'Placas',
    classes: ['Death Knight', 'Paladin', 'Warrior'],
    icon: '🛡️',
  },
];

// ═══════════════════════════════════════════════════════
//  NOMBRES EN ESPAÑOL
// ═══════════════════════════════════════════════════════

export const CLASS_NAME_ES: Record<string, string> = {
  'Death Knight': 'Caballero de la Muerte',
  'Demon Hunter': 'Cazador de Demonios',
  'Druid': 'Druida',
  'Evoker': 'Evocador',
  'Hunter': 'Cazador',
  'Mage': 'Mago',
  'Monk': 'Monje',
  'Paladin': 'Paladín',
  'Priest': 'Sacerdote',
  'Rogue': 'Pícaro',
  'Shaman': 'Chamán',
  'Warlock': 'Brujo',
  'Warrior': 'Guerrero',
};

export const SPEC_ROLE_MAP: Record<string, 'Tank' | 'Healer' | 'DPS Melee' | 'DPS Ranged'> = {
  'Blood': 'Tank',
  'Frost': 'DPS Melee',
  'Unholy': 'DPS Melee',
  'Havoc': 'DPS Melee',
  'Vengeance': 'Tank',
  'Balance': 'DPS Ranged',
  'Feral': 'DPS Melee',
  'Guardian': 'Tank',
  'Restoration': 'Healer',
  'Augmentation': 'DPS Ranged',
  'Devastation': 'DPS Ranged',
  'Preservation': 'Healer',
  'Beast Mastery': 'DPS Ranged',
  'Marksmanship': 'DPS Ranged',
  'Survival': 'DPS Melee',
  'Arcane': 'DPS Ranged',
  'Fire': 'DPS Ranged',
  'Brewmaster': 'Tank',
  'Mistweaver': 'Healer',
  'Windwalker': 'DPS Melee',
  'Holy': 'Healer',
  'Protection': 'Tank',
  'Retribution': 'DPS Melee',
  'Discipline': 'Healer',
  'Shadow': 'DPS Ranged',
  'Assassination': 'DPS Melee',
  'Outlaw': 'DPS Melee',
  'Subtlety': 'DPS Melee',
  'Elemental': 'DPS Ranged',
  'Enhancement': 'DPS Melee',
  'Affliction': 'DPS Ranged',
  'Demonology': 'DPS Ranged',
  'Destruction': 'DPS Ranged',
  'Arms': 'DPS Melee',
  'Fury': 'DPS Melee',
};

/**
 * Dado un set de clases presentes en el core, devuelve los buffs cubiertos y faltantes.
 */
export function analyzeBuffCoverage(classesPresent: Set<string>): {
  covered: RaidBuff[];
  missing: RaidBuff[];
} {
  const covered: RaidBuff[] = [];
  const missing: RaidBuff[] = [];

  for (const buff of RAID_BUFFS) {
    const isCovered = buff.providedBy.some((cls) => classesPresent.has(cls));
    if (isCovered) {
      covered.push(buff);
    } else {
      missing.push(buff);
    }
  }

  return { covered, missing };
}

/**
 * Analiza cobertura de tier tokens dado un set de clases.
 */
export function analyzeTierTokenCoverage(classesPresent: Set<string>): {
  token: TierToken;
  count: number;
  classesPresent: string[];
}[] {
  return TIER_TOKENS.map((token) => {
    const present = token.classes.filter((cls) => classesPresent.has(cls));
    return { token, count: present.length, classesPresent: present };
  });
}

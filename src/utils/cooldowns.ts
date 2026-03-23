const cooldowns = new Map<string, Map<string, number>>();

export type CooldownTier = 'none' | 'short' | 'medium' | 'long';

const DURATIONS: Record<CooldownTier, number> = {
  none: 0,
  short: 5_000,
  medium: 10_000,
  long: 30_000,
};

const COMMAND_TIERS: Record<string, CooldownTier> = {
  'help': 'none',
  'ping': 'none',

  'afijos': 'short',
  'info-guild': 'short',
  'guild-progress': 'short',
  'ranking-mplus': 'short',
  'mis-personajes': 'short',
  'profesiones': 'short',
  'crafting-order': 'short',

  'crear-raid': 'medium',
  'cancelar-raid': 'medium',
  'buscar-key': 'medium',
  'cerrar-grupo': 'medium',
  'log-raid': 'medium',
  'aplicar': 'medium',
  'reclutamiento': 'medium',
  'stream': 'medium',
  'youtube': 'medium',

  'vincular': 'long',
  'actualizar': 'long',
  'personaje': 'long',
  'setup-server': 'long',
};

export function checkCooldown(userId: string, commandName: string): { blocked: boolean; remaining: number } {
  const tier = COMMAND_TIERS[commandName] ?? 'short';
  const duration = DURATIONS[tier];
  if (duration === 0) return { blocked: false, remaining: 0 };

  if (!cooldowns.has(commandName)) {
    cooldowns.set(commandName, new Map());
  }

  const timestamps = cooldowns.get(commandName)!;
  const now = Date.now();
  const expiresAt = timestamps.get(userId);

  if (expiresAt && now < expiresAt) {
    return { blocked: true, remaining: Math.ceil((expiresAt - now) / 1000) };
  }

  timestamps.set(userId, now + duration);

  setTimeout(() => timestamps.delete(userId), duration);

  return { blocked: false, remaining: 0 };
}

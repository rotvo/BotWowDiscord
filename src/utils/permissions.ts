import type { GuildMember } from 'discord.js';

export type PermissionLevel = 'everyone' | 'member' | 'staff' | 'admin';

const COMMAND_PERMISSIONS: Record<string, PermissionLevel> = {
  'setup-server': 'admin',
  'reclutamiento': 'admin',

  'crear-raid': 'staff',
  'cancelar-raid': 'staff',
  'log-raid': 'staff',
  'cerrar-grupo': 'staff',
  'stream': 'staff',
  'youtube': 'staff',

  'buscar-key': 'member',
  'crafting-order': 'member',
  'profesiones': 'member',
  'vincular': 'everyone',
  'actualizar': 'everyone',
  'mis-personajes': 'everyone',

  'help': 'everyone',
  'ping': 'everyone',
  'personaje': 'everyone',
  'afijos': 'everyone',
  'ranking-mplus': 'everyone',
  'guild-progress': 'everyone',
  'info-guild': 'everyone',
  'aplicar': 'everyone',
};

const STAFF_ROLES = ['Guild Master', 'Oficial'];
const MEMBER_ROLES = ['Guild Master', 'Oficial', 'Raider', 'Trial', 'Miembro'];

function getMemberLevel(member: GuildMember): PermissionLevel {
  if (member.permissions.has('Administrator')) return 'admin';

  const roleNames = member.roles.cache.map((r) => r.name);

  if (STAFF_ROLES.some((r) => roleNames.includes(r))) return 'staff';
  if (MEMBER_ROLES.some((r) => roleNames.includes(r))) return 'member';

  return 'everyone';
}

const LEVEL_HIERARCHY: Record<PermissionLevel, number> = {
  everyone: 0,
  member: 1,
  staff: 2,
  admin: 3,
};

export function checkPermission(
  member: GuildMember | null,
  commandName: string,
): { allowed: boolean; required: PermissionLevel } {
  const required = COMMAND_PERMISSIONS[commandName] ?? 'everyone';

  if (required === 'everyone') return { allowed: true, required };
  if (!member) return { allowed: false, required };

  const userLevel = getMemberLevel(member);
  const allowed = LEVEL_HIERARCHY[userLevel] >= LEVEL_HIERARCHY[required];

  return { allowed, required };
}

const LEVEL_LABELS: Record<PermissionLevel, string> = {
  everyone: 'Todos',
  member: 'Miembros',
  staff: 'Staff (Oficial+)',
  admin: 'Administrador',
};

export function permissionLabel(level: PermissionLevel): string {
  return LEVEL_LABELS[level];
}

import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  GuildOnboardingPromptType,
  GuildOnboardingMode,
  type ChatInputCommandInteraction,
  type Guild,
  type Role,
  type TextChannel,
  type CategoryChannel,
  type GuildOnboardingPromptOptionData,
  type WelcomeChannelData,
} from 'discord.js';
import {
  WOW_CLASSES,
  WOW_CLASS_COLORS,
  ROLE_TYPES,
  ACTIVITY_TYPES,
  GUILD_RANKS,
  WOW_PROFESSIONS,
  WOW_PROFESSIONS_CRAFTING,
  WOW_PROFESSIONS_GATHERING,
  WOW_PROFESSIONS_SECONDARY,
  WOW_PROFESSION_COLORS,
  EMBED_COLORS,
} from '../../utils/constants.js';
import { wowEmbed, successEmbed } from '../../utils/embeds.js';
import { getChannelDisplayName, getLogicalNameFromChannelName } from '../../utils/channels.js';

interface ChannelDef {
  name: string;
  topic?: string;
  nsfw?: boolean;
  voice?: boolean;
  readOnly?: boolean;
  staffOnly?: boolean;
}

interface CategoryDef {
  channels: ChannelDef[];
  gated?: boolean;
}

const CATEGORY_CHANNELS: Record<string, CategoryDef> = {
  'MODERACION': {
    channels: [
      { name: 'log-moderacion', topic: '📋 Logs automáticos: entradas, salidas y cambios de rol de miembros. Solo staff.', staffOnly: true },
      { name: 'log-audit', topic: '🔒 Registro de acciones administrativas (kicks, bans, etc). Solo staff.', staffOnly: true },
    ],
  },
  'GENERAL': {
    channels: [
      { name: 'chat-general', topic: '💬 Conversación libre. Aquí puedes escribir y usar /vincular para desbloquear el servidor.' },
      { name: 'chat-general-wow', topic: '⚔️ Todo sobre WoW: noticias, parches, builds y discusión del juego.' },
      { name: 'memes', topic: '😂 Memes, shitpost y humor de WoW. Sin spam.' },
      { name: 'chamba', topic: '💼 Temas de trabajo, vida y lo que no sea WoW.' },
    ],
  },
  'BIENVENIDA': {
    channels: [
      { name: 'reglas', topic: '📜 Reglas del servidor. Léelas antes de participar.' },
      { name: 'bienvenida', topic: '👋 Mensajes de bienvenida a nuevos miembros. Pasos: reglas → /vincular en #chat-general.' },
      { name: 'nuevos-personajes', topic: '🛡️ Aquí se publican los personajes vinculados. Comandos: /vincular · /mis-personajes · /actualizar' },
      { name: 'roles', topic: '🎮 Elige tu clase, rol, notificaciones y profesiones con los botones. Solo lectura.' },
    ],
  },
  'RAIDS': {
    gated: true,
    channels: [
      { name: 'anuncios-raid', topic: '📢 Anuncios oficiales de raid. Solo staff publica.' },
      { name: 'asistencia-raid', topic: '📅 Raids programadas. Comandos: /crear-raid · /cancelar-raid · /log-raid. Anótate con los botones.' },
      { name: 'core-raid', topic: '🏰 Composición del Core de raid. Inscríbete con los botones. Se actualiza en tiempo real.' },
    ],
  },
  'MITICAS+': {
    gated: true,
    channels: [
      { name: 'buscar-grupo', topic: '🔑 Grupos M+. Comandos: /buscar-key · /cerrar-grupo · /afijos · /ranking-mplus. Unite con los botones.' },
    ],
  },
  'PROFESIONES': {
    gated: true,
    channels: [
      { name: 'crafting-orders', topic: '⚒️ Pedidos de crafteo entre guildies. /crafting-order crear · completar · cancelar. Acepta con "Yo lo crafteo".' },
      { name: 'profesiones-chat', topic: '📦 Profesiones: /profesiones registrar · mias · buscar. Charla sobre especializaciones y recetas.' },
    ],
  },
};

async function createRoles(guild: Guild): Promise<Map<string, Role>> {
  const roleMap = new Map<string, Role>();

  await guild.roles.fetch();

  const actColors: Record<string, number> = {
    'Raids': 0xE74C3C,
    'Miticas+': 0xE67E22,
    'PvP': 0x9B59B6,
  };
  for (const name of [...ACTIVITY_TYPES].reverse()) {
    const existing = guild.roles.cache.find((r) => r.name === name);
    const role = existing ?? await guild.roles.create({
      name,
      colors: { primaryColor: actColors[name] ?? 0x95A5A6 },
      mentionable: name === 'Miticas+',
      reason: 'Setup: Activity role',
    });
    if (existing && name === 'Miticas+') await (existing as Role).setMentionable(true).catch(() => {});
    roleMap.set(name, role);
  }

  const roleColors: Record<string, number> = {
    'Tank': 0x3498DB,
    'Healer': 0x2ECC71,
    'DPS Melee': 0xE74C3C,
    'DPS Ranged': 0xE67E22,
  };
  for (const name of [...ROLE_TYPES].reverse()) {
    const existing = guild.roles.cache.find((r) => r.name === name);
    const role = existing ?? await guild.roles.create({
      name,
      colors: { primaryColor: roleColors[name] ?? 0x95A5A6 },
      reason: 'Setup: WoW role',
    });
    roleMap.set(name, role);
  }

  for (const name of [...WOW_CLASSES].reverse()) {
    const existing = guild.roles.cache.find((r) => r.name === name);
    const role = existing ?? await guild.roles.create({
      name,
      colors: { primaryColor: WOW_CLASS_COLORS[name] },
      reason: 'Setup: WoW class role',
    });
    roleMap.set(name, role);
  }

  for (const name of [...WOW_PROFESSIONS].reverse()) {
    const existing = guild.roles.cache.find((r) => r.name === name);
    const role = existing ?? await guild.roles.create({
      name,
      colors: { primaryColor: WOW_PROFESSION_COLORS[name] ?? 0x95A5A6 },
      mentionable: true,
      reason: 'Setup: Profession role',
    });
    roleMap.set(name, role);
  }

  const rankColors: Record<string, number> = {
    'Guild Master': 0xF1C40F,
    'Oficial': 0xE74C3C,
    'Raider': 0x9B59B6,
    'Trial': 0xE67E22,
    'Miembro': 0x3498DB,
    'Invitado': 0x95A5A6,
  };
  for (const name of [...GUILD_RANKS].reverse()) {
    const existing = guild.roles.cache.find((r) => r.name === name);
    const role = existing ?? await guild.roles.create({
      name,
      colors: { primaryColor: rankColors[name] ?? 0x95A5A6 },
      hoist: true,
      mentionable: name === 'Raider',
      reason: 'Setup: Guild rank',
    });
    if (existing && name === 'Raider') await (existing as Role).setMentionable(true).catch(() => {});
    roleMap.set(name, role);
  }

  return roleMap;
}

async function createChannels(guild: Guild, roleMap: Map<string, Role>): Promise<Map<string, TextChannel>> {
  const channelMap = new Map<string, TextChannel>();
  await guild.channels.fetch();
  const everyoneRole = guild.roles.everyone;
  const staffRoles = ['Guild Master', 'Oficial'].map((n) => roleMap.get(n)).filter(Boolean) as Role[];
  const memberRoles = ['Guild Master', 'Oficial', 'Raider', 'Trial', 'Miembro']
    .map((n) => roleMap.get(n))
    .filter(Boolean) as Role[];

  for (const [catName, catDef] of Object.entries(CATEGORY_CHANNELS)) {
    const catNameNorm = catName.toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    let category = guild.channels.cache.find(
      (c) => {
        if (c.type !== ChannelType.GuildCategory) return false;
        const nameNorm = c.name.trim().replace(/^[\s\-.,:;]+/u, '').toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
        return nameNorm === catNameNorm;
      },
    ) as CategoryChannel | undefined;

    const catPerms: Array<{ id: string; allow?: bigint[]; deny?: bigint[] }> = [];
    if (catDef.gated) {
      catPerms.push({ id: everyoneRole.id, deny: [PermissionFlagsBits.ViewChannel] });
      for (const mr of memberRoles) {
        catPerms.push({ id: mr.id, allow: [PermissionFlagsBits.ViewChannel] });
      }
    }

    if (!category) {
      category = await guild.channels.create({
        name: catName,
        type: ChannelType.GuildCategory,
        permissionOverwrites: catPerms.length > 0 ? catPerms : undefined,
        reason: 'Setup: Category',
      });
    } else if (catDef.gated) {
      try {
        await category.permissionOverwrites.set(catPerms.map((p) => ({
          id: p.id,
          allow: p.allow ?? [],
          deny: p.deny ?? [],
        })));
      } catch { /* may fail on existing categories */ }
    }

    for (const ch of catDef.channels) {
      const displayName = getChannelDisplayName(ch.name);
      // Buscar por nombre lógico: encuentra "crafting-orders" y "⚒️ crafting-orders" (evita duplicados por emoji/unicode)
      let existing = guild.channels.cache.find(
        (c) =>
          !c.isVoiceBased() &&
          getLogicalNameFromChannelName(c.name) === ch.name,
      ) as TextChannel | undefined;
      if (!existing) {
        existing = guild.channels.cache.find(
          (c) =>
            !c.isVoiceBased() &&
            (c.name === ch.name || (displayName && c.name === displayName)),
        ) as TextChannel | undefined;
      }
      if (existing && existing.parentId !== category!.id) {
        try {
          await existing.setParent(category!.id);
        } catch {
          // No borrar existing: si falla el move, reusamos el canal igual y no creamos duplicado
        }
      }

      if (existing) {
        if (!ch.voice) channelMap.set(ch.name, existing as TextChannel);
        if ('permissionOverwrites' in existing) {
          const chan = existing as TextChannel;
          try {
            const displayName = getChannelDisplayName(ch.name);
            if (displayName && displayName !== ch.name) await chan.setName(displayName);
            if (ch.topic) await chan.setTopic(ch.topic);
            if (catDef.gated) {
              await chan.permissionOverwrites.edit(everyoneRole, { ViewChannel: false });
              for (const mr of memberRoles) {
                await chan.permissionOverwrites.edit(mr, { ViewChannel: true });
              }
            }
            if (ch.readOnly) {
              await chan.permissionOverwrites.edit(everyoneRole, { SendMessages: false });
            }
            if (ch.staffOnly) {
              await chan.permissionOverwrites.edit(everyoneRole, { ViewChannel: false });
              for (const sr of staffRoles) {
                await chan.permissionOverwrites.edit(sr, { ViewChannel: true, SendMessages: true });
              }
            }
          } catch (err) {
            console.warn(`[setup-server] Permisos de ${ch.name}:`, err);
          }
        }
        continue;
      }

      if (ch.voice) {
        const voicePerms: Array<{ id: string; allow?: bigint[]; deny?: bigint[] }> = [];
        if (catDef.gated) {
          voicePerms.push({ id: everyoneRole.id, deny: [PermissionFlagsBits.ViewChannel] });
          for (const mr of memberRoles) {
            voicePerms.push({ id: mr.id, allow: [PermissionFlagsBits.ViewChannel] });
          }
        }
        await guild.channels.create({
          name: ch.name,
          type: ChannelType.GuildVoice,
          parent: category,
          permissionOverwrites: voicePerms.length > 0 ? voicePerms : undefined,
          reason: 'Setup: Voice channel',
        });
        continue;
      }

      const permissionOverwrites: Array<{
        id: string;
        allow?: bigint[];
        deny?: bigint[];
      }> = [];

      if (catDef.gated) {
        permissionOverwrites.push({ id: everyoneRole.id, deny: [PermissionFlagsBits.ViewChannel] });
        for (const mr of memberRoles) {
          permissionOverwrites.push({ id: mr.id, allow: [PermissionFlagsBits.ViewChannel] });
        }
      }

      if (ch.readOnly) {
        const existing = permissionOverwrites.find((p) => p.id === everyoneRole.id);
        if (existing) {
          existing.deny = [...(existing.deny ?? []), PermissionFlagsBits.SendMessages];
        } else {
          permissionOverwrites.push({
            id: everyoneRole.id,
            deny: [PermissionFlagsBits.SendMessages],
          });
        }
      }

      if (ch.staffOnly) {
        permissionOverwrites.push(
          { id: everyoneRole.id, deny: [PermissionFlagsBits.ViewChannel] },
          ...staffRoles.map((r) => ({
            id: r.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
          })),
        );
      }

      const newChannel = await guild.channels.create({
        name: getChannelDisplayName(ch.name),
        type: ChannelType.GuildText,
        parent: category,
        topic: ch.topic,
        permissionOverwrites,
        reason: 'Setup: Text channel',
      });

      channelMap.set(ch.name, newChannel);
    }
  }

  return channelMap;
}

function buildClassButtons(): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  const classes = [...WOW_CLASSES];

  for (let i = 0; i < classes.length; i += 5) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    const chunk = classes.slice(i, i + 5);
    for (const cls of chunk) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`role_class_${cls}`)
          .setLabel(cls)
          .setStyle(ButtonStyle.Secondary),
      );
    }
    rows.push(row);
  }
  return rows;
}

function buildRoleButtons(): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();
  const styles = [ButtonStyle.Primary, ButtonStyle.Success, ButtonStyle.Danger, ButtonStyle.Secondary];
  ROLE_TYPES.forEach((role, i) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`role_type_${role}`)
        .setLabel(role)
        .setStyle(styles[i] ?? ButtonStyle.Secondary),
    );
  });
  return row;
}

function buildActivityButtons(): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();
  ACTIVITY_TYPES.forEach((act) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`role_activity_${act}`)
        .setLabel(act)
        .setStyle(ButtonStyle.Primary),
    );
  });
  return row;
}

function buildProfessionButtons(): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  const craftingRow1 = new ActionRowBuilder<ButtonBuilder>();
  const craftingRow2 = new ActionRowBuilder<ButtonBuilder>();
  const crafting = [...WOW_PROFESSIONS_CRAFTING];
  for (let i = 0; i < crafting.length; i++) {
    const btn = new ButtonBuilder()
      .setCustomId(`role_prof_${crafting[i]}`)
      .setLabel(crafting[i])
      .setStyle(ButtonStyle.Secondary);
    if (i < 4) craftingRow1.addComponents(btn);
    else craftingRow2.addComponents(btn);
  }
  rows.push(craftingRow1, craftingRow2);

  const gatheringRow = new ActionRowBuilder<ButtonBuilder>();
  for (const prof of WOW_PROFESSIONS_GATHERING) {
    gatheringRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`role_prof_${prof}`)
        .setLabel(prof)
        .setStyle(ButtonStyle.Success),
    );
  }
  rows.push(gatheringRow);

  const secondaryRow = new ActionRowBuilder<ButtonBuilder>();
  for (const prof of WOW_PROFESSIONS_SECONDARY) {
    secondaryRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`role_prof_${prof}`)
        .setLabel(prof)
        .setStyle(ButtonStyle.Primary),
    );
  }
  rows.push(secondaryRow);

  return rows;
}

async function configureOnboarding(
  guild: Guild,
  roleMap: Map<string, Role>,
  channelMap: Map<string, TextChannel>,
): Promise<void> {
  const everyoneRole = guild.roles.everyone;
  const defaultChannels = guild.channels.cache.filter((c) => {
    if (c.type !== ChannelType.GuildText && c.type !== ChannelType.GuildAnnouncement) return false;
    const perms = c.permissionsFor(everyoneRole);
    return perms?.has(PermissionFlagsBits.ViewChannel) ?? false;
  }).map((c) => c as TextChannel);
  const defaultChannelArray = [...defaultChannels.values()];

  const makeRoleOption = (name: string, extraChannels: string[] = []): GuildOnboardingPromptOptionData | null => {
    const role = roleMap.get(name);
    if (!role) return null;
    const chs = extraChannels
      .map((n) => channelMap.get(n))
      .filter(Boolean) as TextChannel[];
    return { title: name, roles: [role], channels: chs };
  };

  const activityChannelMap: Record<string, string[]> = {
    'Raids': ['anuncios-raid', 'asistencia-raid'],
    'Miticas+': ['buscar-grupo'],
    'PvP': [],
  };
  const activityOptions: GuildOnboardingPromptOptionData[] = [];
  for (const act of ACTIVITY_TYPES) {
    const opt = makeRoleOption(act, activityChannelMap[act] ?? []);
    if (opt) activityOptions.push(opt);
  }

  const roleOptions: GuildOnboardingPromptOptionData[] = [];
  for (const r of ROLE_TYPES) {
    const opt = makeRoleOption(r);
    if (opt) roleOptions.push(opt);
  }

  const classOptions: GuildOnboardingPromptOptionData[] = [];
  for (const cls of WOW_CLASSES) {
    const opt = makeRoleOption(cls);
    if (opt) classOptions.push(opt);
  }

  const professionOptions: GuildOnboardingPromptOptionData[] = [];
  for (const prof of WOW_PROFESSIONS) {
    const opt = makeRoleOption(prof);
    if (opt) professionOptions.push(opt);
  }

  const prompts = [
    {
      title: 'Que contenido te interesa?',
      type: GuildOnboardingPromptType.MultipleChoice,
      singleSelect: false,
      required: true,
      inOnboarding: true,
      options: activityOptions,
    },
    {
      title: 'Que roles juegas?',
      type: GuildOnboardingPromptType.MultipleChoice,
      singleSelect: false,
      required: true,
      inOnboarding: true,
      options: roleOptions,
    },
    {
      title: 'Que clases juegas?',
      type: GuildOnboardingPromptType.Dropdown,
      singleSelect: false,
      required: false,
      inOnboarding: true,
      options: classOptions,
    },
    {
      title: 'Que profesiones tienes?',
      type: GuildOnboardingPromptType.Dropdown,
      singleSelect: false,
      required: false,
      inOnboarding: true,
      options: professionOptions,
    },
  ];

  await guild.editOnboarding({
    enabled: true,
    mode: GuildOnboardingMode.OnboardingDefault,
    prompts,
    defaultChannels: defaultChannelArray,
  });
}

async function configureWelcomeScreen(
  guild: Guild,
  channelMap: Map<string, TextChannel>,
): Promise<void> {
  const welcomeChannels: WelcomeChannelData[] = [];

  const channelConfigs: { name: string; description: string; emoji: string }[] = [
    { name: 'reglas', description: 'Lee las reglas antes de empezar', emoji: '📜' },
    { name: 'roles', description: 'Elige tu clase, rol y profesiones', emoji: '🎮' },
    { name: 'nuevos-personajes', description: 'Mira los personajes de la guild', emoji: '🛡️' },
    { name: 'chat-general', description: 'Conversacion libre con la guild', emoji: '💬' },
  ];

  for (const cfg of channelConfigs) {
    const ch = channelMap.get(cfg.name);
    if (ch) {
      welcomeChannels.push({
        channel: ch,
        description: cfg.description,
        emoji: cfg.emoji,
      });
    }
  }

  await guild.editWelcomeScreen({
    enabled: true,
    description: 'Bienvenido a la guild! Sigue estos pasos para empezar tu aventura con nosotros.',
    welcomeChannels,
  });
}

const CHANNEL_GUIDES: { channel: string; title: string; description: string }[] = [
  {
    channel: 'asistencia-raid',
    title: 'Raids — Este canal',
    description: [
      '**Comandos de este canal:**',
      '`/crear-raid` — Crea una raid',
      '`/cancelar-raid` — Cancela una raid',
      '`/log-raid` — Registra resultado',
      '',
      'Anotate con los botones en cada mensaje de raid.',
    ].join('\n'),
  },
  {
    channel: 'buscar-grupo',
    title: 'Miticas+ — Este canal',
    description: [
      '**Comandos de este canal:**',
      '`/buscar-key` — Publica un grupo M+',
      '`/cerrar-grupo` — Cierra tu grupo',
      '`/afijos` — Afijos de la semana',
      '`/ranking-mplus` — Ranking de la guild',
      '',
      'Unite con los botones en cada mensaje de grupo.',
    ].join('\n'),
  },
  {
    channel: 'crafting-orders',
    title: 'Crafteo — Este canal',
    description: [
      '**Comandos de este canal:**',
      '`/crafting-order crear` — Publica un pedido',
      '`/crafting-order completar` — Marca listo',
      '`/crafting-order cancelar` — Cancela',
      '`/crafting-order mis-pedidos` — Ver tus pedidos',
      '',
      'Acepta pedidos con el boton "Yo lo crafteo".',
    ].join('\n'),
  },
  {
    channel: 'nuevos-personajes',
    title: 'Personajes — Este canal',
    description: [
      'Aqui se publican los personajes vinculados.',
      '**Comandos:** `/vincular nombre realm` · `/mis-personajes` · `/actualizar`',
    ].join('\n'),
  },
  {
    channel: 'profesiones-chat',
    title: 'Profesiones — Este canal',
    description: [
      '**Comandos de este canal:**',
      '`/profesiones registrar` · `/profesiones mias` · `/profesiones buscar`',
    ].join('\n'),
  },
];

async function channelHasBotMessages(channel: TextChannel, botId: string): Promise<boolean> {
  try {
    const msgs = await channel.messages.fetch({ limit: 10 });
    return msgs.some((m) => m.author.id === botId);
  } catch { return false; }
}

async function sendChannelGuides(channelMap: Map<string, TextChannel>, botId: string): Promise<void> {
  for (const guide of CHANNEL_GUIDES) {
    const channel = channelMap.get(guide.channel);
    if (!channel) continue;
    if (await channelHasBotMessages(channel, botId)) continue;
    const embed = wowEmbed(guide.title, guide.description)
      .setFooter({ text: 'Usa /help para ver todos los comandos' });
    const msg = await channel.send({ embeds: [embed] });
    try { await msg.pin(); } catch { /* may lack perms */ }
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('setup-server')
    .setDescription('Configura roles, canales y estructura del servidor (solo admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Este comando solo funciona en un servidor.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      await interaction.editReply('Creando roles...');
      const roleMap = await createRoles(interaction.guild);

      await interaction.editReply('Creando canales...');
      const channelMap = await createChannels(interaction.guild, roleMap);

      const botId = interaction.client.user!.id;

      const rolesChannel = channelMap.get('roles');
      if (rolesChannel && !(await channelHasBotMessages(rolesChannel, botId))) {
        await interaction.editReply('Enviando mensajes de auto-asignacion de roles...');

        const roleEmbed = wowEmbed(
          'Elige tu Rol',
          'Selecciona los roles que juegas. Puedes elegir varios.',
        );
        await rolesChannel.send({ embeds: [roleEmbed], components: [buildRoleButtons()] });

        const profEmbed = wowEmbed(
          'Profesiones',
          'Selecciona tus profesiones. Puedes elegir varias (2 principales + secundarias).\nUsa `/profesiones registrar` para agregar detalles como especializacion y nivel.',
        );
        const profButtons = buildProfessionButtons();
        await rolesChannel.send({ embeds: [profEmbed], components: profButtons });
      }

      const reglas = channelMap.get('reglas');
      if (reglas && !(await channelHasBotMessages(reglas, botId))) {
        const embed = wowEmbed('Reglas del Servidor', [
          '**1.** Respeto entre todos los miembros. Cero toxicidad.',
          '**2.** Se puntual a los raids y eventos. Si no puedes, avisa con tiempo.',
          '**3.** Usa los canales correctos para cada tema.',
          '**4.** No spam ni auto-promocion sin permiso.',
          '**5.** Escucha a los lideres de raid durante el contenido.',
          '**6.** Ven preparado: consumibles, enchants, gemas, conoce las mecanicas.',
          '**7.** Reporta problemas a un Oficial, no hagas drama publico.',
          '',
          '*El incumplimiento puede resultar en advertencia o expulsion.*',
        ].join('\n'));
        await reglas.send({ embeds: [embed] });
      }

      await interaction.editReply('Enviando guias de canales...');
      await sendChannelGuides(channelMap, botId);

      await interaction.editReply('Configurando onboarding...');
      let onboardingOk = false;
      try {
        await configureOnboarding(interaction.guild, roleMap, channelMap);
        onboardingOk = true;
      } catch (onboardErr) {
        console.warn('[setup-server] Onboarding failed:', onboardErr);
      }

      await interaction.editReply('Configurando pantalla de bienvenida...');
      let welcomeOk = false;
      try {
        await configureWelcomeScreen(interaction.guild, channelMap);
        welcomeOk = true;
      } catch (welcomeErr) {
        console.warn('[setup-server] Welcome Screen failed:', welcomeErr);
      }

      const summary = successEmbed('Setup Completado', [
        `**Roles creados:** ${roleMap.size}`,
        `**Canales creados:** ${channelMap.size}`,
        `**Onboarding:** ${onboardingOk ? '4 preguntas configuradas' : 'Error (configura manualmente)'}`,
        `**Welcome Screen:** ${welcomeOk ? 'Activa' : 'Error (configura manualmente)'}`,
        '',
        `**Guias de canales:** Enviadas y pineadas`,
        'Revisa #roles para los botones y la vista previa del onboarding.',
      ].join('\n'));

      await interaction.editReply({ content: '', embeds: [summary] });
    } catch (error) {
      console.error('[setup-server]', error);
      await interaction.editReply(`Error durante setup: ${error}`);
    }
  },
};

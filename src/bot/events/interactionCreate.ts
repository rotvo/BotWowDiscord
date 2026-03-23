import {
  Events,
  type Interaction,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  type GuildMember,
} from 'discord.js';
import type { BotClient } from '../client.js';
import fs from 'fs';
import path from 'path';
import { checkCooldown } from '../../utils/cooldowns.js';
import { checkPermission, permissionLabel } from '../../utils/permissions.js';

function getModuleFiles(dirPath: string): string[] {
  return fs.readdirSync(dirPath).filter((file) => {
    const isScriptFile = file.endsWith('.js') || file.endsWith('.ts');
    return isScriptFile && !file.endsWith('.d.ts');
  });
}

const CHANNEL_REMINDERS: Record<string, string> = {
  'buscar-grupo':
    '📌 **Solo este canal:** `/buscar-key` · `/cerrar-grupo` · `/afijos` · `/ranking-mplus` · Guía en mensajes fijados ↑',
  'asistencia-raid':
    '📌 **Solo este canal:** `/crear-raid` · `/cancelar-raid` · `/log-raid` · Guía en mensajes fijados ↑',
  'crafting-orders':
    '📌 **Solo este canal:** `/crafting-order crear` · `completar` · `cancelar` · `mis-pedidos` · Guía en mensajes fijados ↑',
  'profesiones-chat':
    '📌 **Solo este canal:** `/profesiones registrar` · `mias` · `buscar` · Guía en mensajes fijados ↑',
};

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const buttonsPath = path.join(__dirname, '..', 'buttons');
  if (!fs.existsSync(buttonsPath)) return;

  const buttonFiles = getModuleFiles(buttonsPath);

  for (const file of buttonFiles) {
    const mod = require(path.join(buttonsPath, file));
    const handler = mod.default ?? mod;
    if (handler.customId && interaction.customId.startsWith(handler.customId)) {
      await handler.execute(interaction);
      return;
    }
  }
}

async function handleModal(interaction: ModalSubmitInteraction): Promise<void> {
  const modalsPath = path.join(__dirname, '..', 'modals');
  if (!fs.existsSync(modalsPath)) return;

  const modalFiles = getModuleFiles(modalsPath);

  for (const file of modalFiles) {
    const mod = require(path.join(modalsPath, file));
    const handler = mod.default ?? mod;
    if (handler.customId && interaction.customId.startsWith(handler.customId)) {
      await handler.execute(interaction);
      return;
    }
  }
}

async function handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const selectPath = path.join(__dirname, '..', 'selectmenus');
  if (!fs.existsSync(selectPath)) return;

  const files = getModuleFiles(selectPath);

  for (const file of files) {
    const mod = require(path.join(selectPath, file));
    const handler = mod.default ?? mod;
    if (handler.customId && interaction.customId.startsWith(handler.customId)) {
      await handler.execute(interaction);
      return;
    }
  }
}

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction: Interaction) {
    if (interaction.isAutocomplete()) {
      const client = interaction.client as BotClient;
      const command = client.commands.get(interaction.commandName);
      if (command?.autocomplete) {
        try {
          await command.autocomplete(interaction);
        } catch (err) {
          console.error(`[Autocomplete] ${interaction.commandName}:`, err);
        }
      }
      return;
    }
    if (interaction.isChatInputCommand()) {
      const client = interaction.client as BotClient;
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      const member = interaction.member as GuildMember | null;
      const { allowed, required } = checkPermission(member, interaction.commandName);
      if (!allowed) {
        await interaction.reply({
          content: `No tienes permisos para usar este comando. Requiere: **${permissionLabel(required)}**.`,
          ephemeral: true,
        });
        return;
      }

      const cd = checkCooldown(interaction.user.id, interaction.commandName);
      if (cd.blocked) {
        await interaction.reply({
          content: `Espera **${cd.remaining}s** antes de volver a usar este comando.`,
          ephemeral: true,
        });
        return;
      }

      try {
        await command.execute(interaction as ChatInputCommandInteraction);
        const channelName = interaction.channel && 'name' in interaction.channel ? interaction.channel.name : null;
        if (channelName && CHANNEL_REMINDERS[channelName]) {
          await interaction.followUp({
            content: CHANNEL_REMINDERS[channelName],
            ephemeral: true,
          }).catch(() => {});
        }
      } catch (error) {
        console.error(`[Error] Comando ${interaction.commandName}:`, error);
        const msg = { content: 'Hubo un error ejecutando este comando.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(msg);
        } else {
          await interaction.reply(msg);
        }
      }
    } else if (interaction.isButton()) {
      try {
        await handleButton(interaction);
      } catch (error) {
        console.error('[Error] Button:', error);
      }
    } else if (interaction.isModalSubmit()) {
      try {
        await handleModal(interaction);
      } catch (error) {
        console.error('[Error] Modal:', error);
      }
    } else if (interaction.isStringSelectMenu()) {
      try {
        await handleSelectMenu(interaction);
      } catch (error) {
        console.error('[Error] SelectMenu:', error);
      }
    }
  },
};

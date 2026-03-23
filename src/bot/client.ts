import {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  type ChatInputCommandInteraction,
  type SlashCommandBuilder,
} from 'discord.js';
import { config } from '../config.js';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

export interface BotCommand {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export class BotClient extends Client {
  commands = new Collection<string, BotCommand>();

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildModeration,
      ],
      partials: [Partials.Message, Partials.Reaction],
    });
  }

  async loadCommands(): Promise<void> {
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter((f) => f.endsWith('.js') || f.endsWith('.ts'));

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const mod = await import(pathToFileURL(filePath).href);
      const command: BotCommand = mod.default ?? mod;
      if (command.data && typeof command.execute === 'function') {
        this.commands.set(command.data.name, command);
      }
    }
    console.log(`[Bot] ${this.commands.size} comandos cargados.`);
  }

  async loadEvents(): Promise<void> {
    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs
      .readdirSync(eventsPath)
      .filter((f) => f.endsWith('.js') || f.endsWith('.ts'));

    for (const file of eventFiles) {
      const filePath = path.join(eventsPath, file);
      const mod = await import(pathToFileURL(filePath).href);
      const event = mod.default ?? mod;
      if (event.once) {
        this.once(event.name, (...args: unknown[]) => event.execute(...args));
      } else {
        this.on(event.name, (...args: unknown[]) => event.execute(...args));
      }
    }
    console.log(`[Bot] ${eventFiles.length} eventos cargados.`);
  }

  async registerSlashCommands(): Promise<void> {
    const rest = new REST({ version: '10' }).setToken(config.discord.token);
    const commandData = this.commands.map((cmd) => cmd.data.toJSON());

    await rest.put(
      Routes.applicationGuildCommands(
        config.discord.clientId,
        config.discord.guildId,
      ),
      { body: commandData },
    );
    console.log(`[Bot] ${commandData.length} slash commands registrados en guild.`);
  }

  async start(): Promise<void> {
    await this.loadCommands();
    await this.loadEvents();
    await this.login(config.discord.token);
  }
}

import { Events } from 'discord.js';
import type { BotClient } from '../client.js';
import { startScheduler } from '../scheduler.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: BotClient) {
    console.log(`[Bot] Conectado como ${client.user?.tag}`);
    console.log(`[Bot] En ${client.guilds.cache.size} servidor(es)`);

    await client.registerSlashCommands();

    startScheduler(client);

    client.user?.setPresence({
      activities: [{ name: '/help | WoW Guild Bot' }],
      status: 'online',
    });
  },
};

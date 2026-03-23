import { BotClient } from './bot/client.js';
import { getDb, closeDb } from './db/database.js';
import { stopScheduler } from './bot/scheduler.js';

async function main() {
  console.log('[Init] Conectando base de datos...');
  getDb();
  console.log('[Init] Base de datos lista.');

  const client = new BotClient();
  await client.start();

  process.on('SIGINT', () => {
    console.log('\n[Shutdown] Cerrando...');
    stopScheduler();
    closeDb();
    client.destroy();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    stopScheduler();
    closeDb();
    client.destroy();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[Fatal]', err);
  process.exit(1);
});

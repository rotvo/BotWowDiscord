import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'guild.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
  }
  return db;
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT UNIQUE NOT NULL,
      discord_name TEXT NOT NULL,
      wow_character TEXT,
      wow_realm TEXT,
      wow_class TEXT,
      wow_role TEXT,
      guild_rank TEXT DEFAULT 'Invitado',
      joined_at TEXT DEFAULT (datetime('now')),
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT NOT NULL,
      discord_name TEXT NOT NULL,
      character_name TEXT NOT NULL,
      realm TEXT NOT NULL,
      wow_class TEXT,
      spec TEXT,
      experience TEXT,
      motivation TEXT,
      availability TEXT,
      raiderio_score REAL,
      ilvl INTEGER,
      raid_progress TEXT,
      status TEXT DEFAULT 'pending',
      reviewed_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS raids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      description TEXT,
      scheduled_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      message_id TEXT,
      channel_id TEXT,
      status TEXT DEFAULT 'scheduled',
      log_url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS raid_signups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      raid_id INTEGER NOT NULL REFERENCES raids(id) ON DELETE CASCADE,
      discord_id TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT DEFAULT 'confirmed',
      signed_at TEXT DEFAULT (datetime('now')),
      UNIQUE(raid_id, discord_id)
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      raid_id INTEGER NOT NULL REFERENCES raids(id) ON DELETE CASCADE,
      discord_id TEXT NOT NULL,
      present INTEGER DEFAULT 1,
      UNIQUE(raid_id, discord_id)
    );

    CREATE TABLE IF NOT EXISTS mplus_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leader_id TEXT NOT NULL,
      dungeon TEXT,
      key_level INTEGER,
      description TEXT,
      message_id TEXT,
      channel_id TEXT,
      status TEXT DEFAULT 'open',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mplus_signups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES mplus_groups(id) ON DELETE CASCADE,
      discord_id TEXT NOT NULL,
      role TEXT NOT NULL,
      UNIQUE(group_id, discord_id)
    );

    CREATE TABLE IF NOT EXISTS member_professions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT NOT NULL,
      profession TEXT NOT NULL,
      specialization TEXT,
      skill_level INTEGER DEFAULT 0,
      notable_crafts TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(discord_id, profession)
    );

    CREATE TABLE IF NOT EXISTS crafting_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id TEXT NOT NULL,
      crafter_id TEXT,
      profession TEXT NOT NULL,
      item_name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'open',
      message_id TEXT,
      channel_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT NOT NULL,
      wow_character TEXT NOT NULL,
      wow_realm TEXT NOT NULL,
      wow_class TEXT,
      wow_spec TEXT,
      wow_role TEXT,
      ilvl INTEGER DEFAULT 0,
      rio_score REAL DEFAULT 0,
      is_main INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(discord_id, wow_character, wow_realm)
    );

    CREATE TABLE IF NOT EXISTS core_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT UNIQUE NOT NULL,
      character_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      joined_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS core_config (
      guild_id TEXT PRIMARY KEY,
      channel_id TEXT,
      message_id TEXT
    );

    CREATE TABLE IF NOT EXISTS core_terms_acceptances (
      discord_id TEXT PRIMARY KEY,
      accepted_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS core_pending_signup (
      discord_id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const addColumn = (table: string, column: string, type: string) => {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    } catch {
      // Column already exists
    }
  };

  addColumn('members', 'ilvl', 'INTEGER DEFAULT 0');
  addColumn('members', 'wow_spec', 'TEXT');
  addColumn('members', 'rio_score', 'REAL DEFAULT 0');
  addColumn('members', 'updated_at', "TEXT DEFAULT (datetime('now'))");
  addColumn('raids', 'min_ilvl', 'INTEGER DEFAULT 0');
  addColumn('raids', 'date_end', 'TEXT');
  addColumn('raids', 'start_hour', 'INTEGER');
  addColumn('raids', 'start_minute', 'INTEGER DEFAULT 0');
  addColumn('raids', 'end_hour', 'INTEGER');
  addColumn('raids', 'end_minute', 'INTEGER DEFAULT 0');
  addColumn('raid_signups', 'wow_class', 'TEXT');
  addColumn('raid_signups', 'wow_spec', 'TEXT');
  addColumn('raid_signups', 'ilvl', 'INTEGER DEFAULT 0');
  addColumn('raid_signups', 'character_id', 'INTEGER DEFAULT 0');
  addColumn('mplus_signups', 'wow_class', 'TEXT');
  addColumn('mplus_signups', 'wow_spec', 'TEXT');
  addColumn('mplus_signups', 'ilvl', 'INTEGER DEFAULT 0');
  addColumn('mplus_signups', 'character_id', 'INTEGER DEFAULT 0');
  addColumn('mplus_groups', 'min_ilvl', 'INTEGER DEFAULT 0');
  addColumn('member_professions', 'character_id', 'INTEGER DEFAULT 0');
  addColumn('crafting_orders', 'crafter_character_id', 'INTEGER DEFAULT 0');

  // Migrate existing character data from members to characters table
  try {
    const existing = db.prepare(`SELECT COUNT(*) as cnt FROM characters`).get() as { cnt: number };
    if (existing.cnt === 0) {
      db.exec(`
        INSERT OR IGNORE INTO characters (discord_id, wow_character, wow_realm, wow_class, wow_spec, wow_role, ilvl, rio_score, is_main)
        SELECT discord_id, wow_character, wow_realm, wow_class, COALESCE(wow_spec, ''), COALESCE(wow_role, ''), COALESCE(ilvl, 0), COALESCE(rio_score, 0), 1
        FROM members
        WHERE wow_character IS NOT NULL AND wow_character != ''
      `);
    }
  } catch {
    // Migration already done or no data
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}

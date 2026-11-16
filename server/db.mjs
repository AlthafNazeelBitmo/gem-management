import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync, copyFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const isVercel = !!process.env.VERCEL;
export const dataDirectory = process.env.DATA_DIR || (
  isVercel ? path.join("/tmp", "gem-data") : path.resolve("data")
);
mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });

const dbPath = path.join(dataDirectory, "gem.sqlite");

if (!existsSync(dbPath)) {
  const seedCandidates = [
    path.resolve("server", "seed.sqlite"),
    path.resolve("data", "gem.sqlite"),
  ];
  for (const candidate of seedCandidates) {
    if (existsSync(candidate)) {
      try {
        copyFileSync(candidate, dbPath);
        console.log(`Database initialized from seed: ${candidate}`);
        break;
      } catch (err) {
        console.error(`Failed to copy seed database from ${candidate}:`, err);
      }
    }
  }
}

export const db = new DatabaseSync(dbPath);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(kind,id));
CREATE INDEX IF NOT EXISTS records_kind ON records(kind);
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires TEXT NOT NULL, csrf TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events (sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE, at TEXT NOT NULL, actor TEXT NOT NULL, role TEXT NOT NULL, action TEXT NOT NULL, record_id TEXT, before_json TEXT, after_json TEXT);
CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, stone_id TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, bytes BLOB NOT NULL, at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS replay (id TEXT PRIMARY KEY, result TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS command_receipts (
  user_id TEXT NOT NULL, request_id TEXT NOT NULL, fingerprint TEXT NOT NULL,
  result TEXT NOT NULL, expires TEXT NOT NULL, PRIMARY KEY (user_id, request_id)
);
CREATE INDEX IF NOT EXISTS command_receipts_expiry ON command_receipts(expires);
CREATE TRIGGER IF NOT EXISTS immutable_events_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT, 'Audit events are immutable'); END;
CREATE TRIGGER IF NOT EXISTS immutable_events_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT, 'Audit events are immutable'); END;`);
export const uid = (prefix) =>
  `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
export const now = () => new Date().toISOString();

import pg from "pg";

export const pgPool = process.env.DATABASE_URL
  ? new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
    })
  : null;

export async function initNeon() {
  if (!pgPool) return;
  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, data JSONB NOT NULL, PRIMARY KEY(kind,id));
      CREATE INDEX IF NOT EXISTS records_kind ON records(kind);
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires TEXT NOT NULL, csrf TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (sequence SERIAL PRIMARY KEY, id TEXT UNIQUE, at TEXT NOT NULL, actor TEXT NOT NULL, role TEXT NOT NULL, action TEXT NOT NULL, record_id TEXT, before_json TEXT, after_json TEXT);
      CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, stone_id TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, bytes BYTEA NOT NULL, at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), data JSONB NOT NULL);
      CREATE TABLE IF NOT EXISTS replay (id TEXT PRIMARY KEY, result TEXT NOT NULL);
    `);

    const countRes = await pgPool.query("SELECT COUNT(*) as c FROM records");
    const count = Number(countRes.rows[0]?.c || 0);

    if (count > 0) {
      const { rows: pgRecords } = await pgPool.query("SELECT kind, id, data FROM records");
      const insertRecord = db.prepare(
        "INSERT INTO records(kind,id,data) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data"
      );
      for (const r of pgRecords) {
        const dataStr = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
        insertRecord.run(r.kind, r.id, dataStr);
      }

      const { rows: pgSettings } = await pgPool.query("SELECT data FROM settings WHERE id=1");
      if (pgSettings.length > 0) {
        const sStr = typeof pgSettings[0].data === "string" ? pgSettings[0].data : JSON.stringify(pgSettings[0].data);
        db.prepare("INSERT INTO settings(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data").run(sStr);
      }

      const { rows: pgUsers } = await pgPool.query("SELECT id, name, email, password, role, active FROM users");
      const insertUser = db.prepare(
        "INSERT INTO users(id,name,email,password,role,active) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, email=excluded.email, password=excluded.password, role=excluded.role, active=excluded.active"
      );
      for (const u of pgUsers) {
        insertUser.run(u.id, u.name, u.email, u.password, u.role, u.active);
      }
      console.log(`Synced ${pgRecords.length} records, ${pgUsers.length} users from Neon Postgres`);
    } else {
      const localRecords = db.prepare("SELECT kind, id, data FROM records").all();
      for (const r of localRecords) {
        await pgPool.query(
          "INSERT INTO records(kind, id, data) VALUES($1, $2, $3) ON CONFLICT(kind, id) DO UPDATE SET data = EXCLUDED.data",
          [r.kind, r.id, r.data]
        );
      }
      const localSettings = db.prepare("SELECT data FROM settings WHERE id=1").get();
      if (localSettings) {
        await pgPool.query(
          "INSERT INTO settings(id, data) VALUES(1, $1) ON CONFLICT(id) DO UPDATE SET data = EXCLUDED.data",
          [localSettings.data]
        );
      }
      const localUsers = db.prepare("SELECT id, name, email, password, role, active FROM users").all();
      for (const u of localUsers) {
        await pgPool.query(
          "INSERT INTO users(id, name, email, password, role, active) VALUES($1, $2, $3, $4, $5, $6) ON CONFLICT(id) DO NOTHING",
          [u.id, u.name, u.email, u.password, u.role, u.active]
        );
      }
      console.log(`Seeded Neon Postgres with ${localRecords.length} records and ${localUsers.length} users`);
    }
  } catch (err) {
    console.error("Failed to initialize Neon Postgres:", err);
  }
}

export function syncUser(u) {
  if (!pgPool) return;
  pgPool
    .query(
      "INSERT INTO users(id,name,email,password,role,active) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name, email=EXCLUDED.email, password=EXCLUDED.password, role=EXCLUDED.role, active=EXCLUDED.active",
      [u.id, u.name, u.email, u.password, u.role, u.active ? 1 : 0]
    )
    .catch((err) => console.error("Neon Postgres syncUser error:", err.message));
}

export function syncSession(token, userId, expires, csrf) {
  if (!pgPool) return;
  pgPool
    .query(
      "INSERT INTO sessions(token, user_id, expires, csrf) VALUES($1,$2,$3,$4) ON CONFLICT(token) DO UPDATE SET expires=EXCLUDED.expires, csrf=EXCLUDED.csrf",
      [token, userId, expires, csrf]
    )
    .catch((err) => console.error("Neon Postgres syncSession error:", err.message));
}

export function deleteSession(token) {
  if (!pgPool) return;
  pgPool
    .query("DELETE FROM sessions WHERE token = $1", [token])
    .catch((err) => console.error("Neon Postgres deleteSession error:", err.message));
}

export function syncFile(id, stoneId, name, mime, bytes, at) {
  if (!pgPool) return;
  pgPool
    .query(
      "INSERT INTO files(id, stone_id, name, mime, bytes, at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING",
      [id, stoneId, name, mime, bytes, at]
    )
    .catch((err) => console.error("Neon Postgres syncFile error:", err.message));
}

export function all(kind) {
  return db
    .prepare("SELECT data FROM records WHERE kind=? ORDER BY rowid DESC")
    .all(kind)
    .map((r) => JSON.parse(r.data));
}
export function get(kind, id) {
  const r = db
    .prepare("SELECT data FROM records WHERE kind=? AND id=?")
    .get(kind, id);
  return r ? JSON.parse(r.data) : null;
}
export function put(kind, record) {
  const dataStr = JSON.stringify(record);
  db.prepare(
    "INSERT INTO records(kind,id,data) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data",
  ).run(kind, record.id, dataStr);
  if (pgPool) {
    pgPool
      .query(
        "INSERT INTO records(kind,id,data) VALUES($1,$2,$3) ON CONFLICT(kind,id) DO UPDATE SET data=EXCLUDED.data",
        [kind, record.id, dataStr]
      )
      .catch((err) => console.error("Neon Postgres put error:", err.message));
  }
  return record;
}
export function settings() {
  const r = db.prepare("SELECT data FROM settings WHERE id=1").get();
  return r ? JSON.parse(r.data) : null;
}
export function saveSettings(s) {
  const sStr = JSON.stringify(s);
  db.prepare(
    "INSERT INTO settings(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
  ).run(sStr);
  if (pgPool) {
    pgPool
      .query(
        "INSERT INTO settings(id,data) VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data",
        [sStr]
      )
      .catch((err) => console.error("Neon Postgres saveSettings error:", err.message));
  }
  return s;
}
export function transaction(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export function audit(user, action, id, before, after) {
  const evtId = uid("EVT");
  const timestamp = now();
  const beforeStr = before ? JSON.stringify(before) : null;
  const afterStr = after ? JSON.stringify(after) : null;
  db.prepare(
    "INSERT INTO events(id,at,actor,role,action,record_id,before_json,after_json) VALUES(?,?,?,?,?,?,?,?)",
  ).run(
    evtId,
    timestamp,
    user.name,
    user.role,
    action,
    id || "",
    beforeStr,
    afterStr,
  );
  if (pgPool) {
    pgPool
      .query(
        "INSERT INTO events(id,at,actor,role,action,record_id,before_json,after_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [evtId, timestamp, user.name, user.role, action, id || "", beforeStr, afterStr]
      )
      .catch((err) => console.error("Neon Postgres audit error:", err.message));
  }
}

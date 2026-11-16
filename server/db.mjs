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
CREATE TRIGGER IF NOT EXISTS immutable_events_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT, 'Audit events are immutable'); END;
CREATE TRIGGER IF NOT EXISTS immutable_events_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT, 'Audit events are immutable'); END;`);
export const uid = (prefix) =>
  `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
export const now = () => new Date().toISOString();
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
  db.prepare(
    "INSERT INTO records(kind,id,data) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data",
  ).run(kind, record.id, JSON.stringify(record));
  return record;
}
export function settings() {
  const r = db.prepare("SELECT data FROM settings WHERE id=1").get();
  return r ? JSON.parse(r.data) : null;
}
export function saveSettings(s) {
  db.prepare(
    "INSERT INTO settings(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
  ).run(JSON.stringify(s));
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
  db.prepare(
    "INSERT INTO events(id,at,actor,role,action,record_id,before_json,after_json) VALUES(?,?,?,?,?,?,?,?)",
  ).run(
    uid("EVT"),
    now(),
    user.name,
    user.role,
    action,
    id || "",
    before ? JSON.stringify(before) : null,
    after ? JSON.stringify(after) : null,
  );
}

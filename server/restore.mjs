import { DatabaseSync } from "node:sqlite";
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
const [source, flag] = process.argv.slice(2);
if (!source || flag !== "--confirm-replace")
  throw new Error(
    "Stop the server, then run: node server/restore.mjs /absolute/backup.sqlite --confirm-replace",
  );
const backup = new DatabaseSync(path.resolve(source), { readOnly: true });
const integrity = backup.prepare("PRAGMA integrity_check").get();
if (Object.values(integrity)[0] !== "ok")
  throw new Error("Backup integrity check failed.");
for (const table of [
  "records",
  "users",
  "events",
  "files",
  "settings",
  "sessions",
]) {
  if (
    !backup
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(table)
  )
    throw new Error(`Backup is missing ${table}.`);
}
backup.close();
const dir = process.env.DATA_DIR || path.resolve("data");
mkdirSync(dir, { recursive: true, mode: 0o700 });
const target = path.join(dir, "gem.sqlite");
if (existsSync(target + "-wal") || existsSync(target + "-shm"))
  throw new Error(
    "Database is open or has pending WAL files. Stop the server cleanly before restoring.",
  );
if (existsSync(target))
  copyFileSync(target, target + ".before-restore-" + Date.now());
copyFileSync(path.resolve(source), target);
const restored = new DatabaseSync(target);
restored.exec("DELETE FROM sessions");
restored.close();
console.log(
  "Backup restored and prior sessions revoked. Start the server and sign in again.",
);

// Apply schema.sql to the configured DATABASE_URL. Idempotent — safe to re-run.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { sql } from "./client.js";

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const ddl = await readFile(join(here, "schema.sql"), "utf8");
  await sql.unsafe(ddl);
  console.log("✓ schema applied");
  await sql.end();
}

main().catch((err) => {
  console.error("migration failed:", err);
  process.exit(1);
});

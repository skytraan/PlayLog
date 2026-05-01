import { runner } from "node-pg-migrate";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { env } from "../lib/env.js";

async function main() {
  const direction = (process.argv[2] ?? "up") as "up" | "down";
  const here = dirname(fileURLToPath(import.meta.url));

  await runner({
    databaseUrl: env.databaseUrl,
    migrationsTable: "pgmigrations",
    dir: join(here, "../../migrations"),
    direction,
    count: direction === "up" ? Infinity : 1,
    verbose: true,
  });

  console.log(`✓ migrations applied (${direction})`);
  process.exit(0);
}

main().catch((err) => {
  console.error("migration failed:", err);
  process.exit(1);
});

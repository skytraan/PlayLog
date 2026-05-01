// R2 orphan sweeper. Lists every object under videos/, diffs against
// sessions.video_storage_id, deletes anything not referenced.
//
// Runnable as a script (`npm run cleanup-r2` from server/) — exits 0 on
// success, prints a one-line summary. Designed to be called from cron, a
// GitHub Action, or a manual /schedule prompt; safe to re-run (idempotent).

import { sql } from "../db/client.js";
import { deleteObject, listAllObjects } from "../storage/r2.js";

export interface CleanupReport {
  scannedObjects: number;
  referencedKeys: number;
  orphans: number;
  deleted: number;
  failures: Array<{ key: string; error: string }>;
}

export async function runR2Cleanup(opts: { dryRun?: boolean } = {}): Promise<CleanupReport> {
  const dryRun = opts.dryRun ?? false;

  const [allKeys, refRows] = await Promise.all([
    listAllObjects("videos/"),
    sql`SELECT video_storage_id FROM sessions WHERE video_storage_id IS NOT NULL`,
  ]);

  const referenced = new Set(refRows.map((r) => r.video_storage_id as string));
  const orphans = allKeys.filter((k) => !referenced.has(k));

  const failures: CleanupReport["failures"] = [];
  let deleted = 0;

  if (!dryRun) {
    for (const key of orphans) {
      try {
        await deleteObject(key);
        deleted += 1;
      } catch (err) {
        failures.push({
          key,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return {
    scannedObjects: allKeys.length,
    referencedKeys: referenced.size,
    orphans: orphans.length,
    deleted,
    failures,
  };
}

// Script entry point. `npm run cleanup-r2` invokes this via tsx.
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const report = await runR2Cleanup({ dryRun });
  console.log(
    `[r2-cleanup] scanned=${report.scannedObjects} referenced=${report.referencedKeys} ` +
      `orphans=${report.orphans} deleted=${report.deleted} failures=${report.failures.length}` +
      (dryRun ? " (dry-run)" : "")
  );
  if (report.failures.length > 0) {
    for (const f of report.failures) {
      console.error(`  failed: ${f.key} — ${f.error}`);
    }
    process.exit(1);
  }
}

// Only run main() when invoked directly, not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("[r2-cleanup] fatal:", err);
    process.exit(1);
  });
}

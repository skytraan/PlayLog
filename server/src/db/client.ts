import postgres from "postgres";
import { env } from "../lib/env.js";

// Single shared connection pool. `transform: { undefined: null }` keeps Convex
// patch-style payloads (where omitted fields stay untouched) easy to express.
export const sql = postgres(env.databaseUrl, {
  max: 10,
  idle_timeout: 20,
  prepare: false,
  transform: { undefined: null },
});

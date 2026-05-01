// Vitest global setup. Populate the env vars that env.ts requires at import
// time, so importing server modules in a test process doesn't blow up trying
// to read real R2 / Postgres credentials.

process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
process.env.R2_ENDPOINT ??= "https://test.r2.cloudflarestorage.com";
process.env.R2_BUCKET ??= "test-bucket";
process.env.R2_ACCESS_KEY_ID ??= "test-access";
process.env.R2_SECRET_ACCESS_KEY ??= "test-secret";
process.env.TWELVELABS_API_KEY ??= "test-twelvelabs-key";
process.env.ANTHROPIC_API_KEY ??= "test-anthropic-key";

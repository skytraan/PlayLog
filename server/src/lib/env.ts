function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name: string): string | undefined {
  return process.env[name];
}

export const env = {
  port: Number(process.env.PORT ?? 8787),
  databaseUrl: required("DATABASE_URL"),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",

  // Cloudflare R2 (S3-compatible)
  r2: {
    endpoint: required("R2_ENDPOINT"),               // e.g. https://<acct>.r2.cloudflarestorage.com
    bucket: required("R2_BUCKET"),
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    publicBaseUrl: optional("R2_PUBLIC_BASE_URL"),   // optional CDN base, falls back to presigned reads
  },

  twelvelabsApiKey: optional("TWELVELABS_API_KEY"),
  geminiApiKey: optional("GEMINI_API_KEY"),
};

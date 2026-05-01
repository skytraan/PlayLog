# PlayLog
AI-powered sports coaching web app.

## Stack

- **Frontend** — React + Vite + TypeScript (Vercel)
- **Backend** — Hono on Node, deployable to Railway / Fly / any Node host
- **Database** — Postgres (Railway / Supabase / Neon — anything that speaks plain Postgres)
- **Object storage** — Cloudflare R2 (S3-compatible, zero egress fees)
- **CV** — MediaPipe (browser-side on the uploaded video)
- **External APIs** — TwelveLabs (Pegasus video understanding) and Gemini (coaching feedback)

## Project Structure

```
PlayLog/
├── server/        # Hono backend — routes, db client, R2 storage, external services
│   └── src/
│       ├── routes/    # one Hono router per domain (users, sessions, ...)
│       ├── services/  # external API integrations (TwelveLabs)
│       ├── db/        # postgres client, schema.sql, migrate runner, mappers
│       ├── storage/   # R2 client + presigned URL helpers
│       └── lib/       # env, errors, rpc helper
├── frontend/      # React + Vite app
│   └── src/lib/api/   # typed client + Convex-shaped hooks (useQuery / useMutation / useAction)
└── package.json   # root scripts that fan out to server/ and frontend/
```

The frontend talks to the backend over a small RPC convention: every endpoint
is `POST /api/<module>/<name>` with a JSON body. The `api` object in
`frontend/src/lib/api/api.ts` mirrors what `convex/_generated/api` used to
expose, so React components keep using `useQuery(api.x.y, args)` and friends.

## Setup

### 1. Backend

```bash
cd server
cp .env.example .env       # fill in DATABASE_URL, R2_*, TWELVELABS_API_KEY, GEMINI_API_KEY
npm install
npm run migrate            # creates the Postgres tables
npm run dev                # boots Hono on :8787
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `R2_ENDPOINT` | `https://<account>.r2.cloudflarestorage.com` |
| `R2_BUCKET` | R2 bucket name |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 token |
| `R2_PUBLIC_BASE_URL` | _(optional)_ CDN base. If set, video reads return `<base>/<key>` instead of presigned URLs — useful for TwelveLabs which sometimes balks at presigned URLs |
| `TWELVELABS_API_KEY` | TwelveLabs API key |
| `GEMINI_API_KEY` | Gemini API key |
| `CORS_ORIGIN` | Comma-separated allowed origins, or `*` |
| `PORT` | Port to listen on (Railway sets this) |

### 2. Frontend

```bash
cd frontend
cp .env.example .env       # set VITE_API_URL to wherever the server is running
npm install
npm run dev                # Vite on :8080
```

### 3. Run both together

```bash
# from repo root
npm run backend     # terminal 1
npm run frontend    # terminal 2
```

## Tests

```bash
npm --prefix server   run test
npm --prefix frontend run test
```

The server twelvelabs tests stub fetch + the SQL client. Database-touching
route tests (sessions, users, etc.) intentionally aren't shipped — they need a
real Postgres or `pg-mem` to be meaningful, which is left as future work.

## Deploying

- **Server** — point Railway at `/server`, set start command to `npm start`,
  set the env vars above. Run `npm run migrate` once after first deploy.
- **Frontend** — Vercel: project root `/frontend`, build `npm run build`,
  output `dist`. Set `VITE_API_URL` to the deployed server URL.

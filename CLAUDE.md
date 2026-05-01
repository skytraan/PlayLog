# Sports Tutor Hackathon

## What
AI-powered sports coaching web app combining computer vision, LLMs, and video intelligence.
- **Frontend**: React + Vite + TypeScript, hosted on Vercel
- **Backend**: Hono server (Node) on Railway, Postgres for data, Cloudflare R2 for video files
- **CV**: MediaPipe (runs in-browser on uploaded video)
- **APIs**: TwelveLabs (video intelligence), Gemini (coaching feedback)

## Project Structure

```
server/   # Hono backend (routes, services, db, storage, lib)
frontend/ # React app — talks to server via src/lib/api
```

## How

### Running the project
```
npm run backend   # Hono dev server on :8787 (server/)
npm run frontend  # Vite dev server on :8080 (frontend/)
npm run migrate   # Apply server/src/db/schema.sql to DATABASE_URL
```

### Type checking & tests
```
npm --prefix server   run typecheck
npm --prefix frontend run typecheck
npm --prefix server   run test
npm --prefix frontend run test
```
Always run typecheck and tests after making changes. Fix all errors before considering a task done.

---

## Code Rules

### Error Handling
- All Hono **service** functions must wrap external API calls (TwelveLabs, Gemini) in `try/catch` and throw an `ApiError` with a descriptive message on failure.
- All **route handlers** that write to Postgres must validate required fields with zod and throw `ApiError` if missing or malformed.
- Frontend async calls to the API must handle errors with `.catch()` or `try/catch` and surface them to the user — never swallow errors silently.

### Schema
- All new tables must be defined in `server/src/db/schema.sql` (DDL) and `server/src/db/types.ts` (TypeScript row shapes).
- Add a mapper in `server/src/db/mappers.ts` for any new table — keeps snake_case → camelCase conversion in one place.
- Update the schema and mapper before writing routes that touch the new table.

### Frontend API surface
- Add new endpoints by registering them in `server/src/routes/<module>.ts` then declaring them in `frontend/src/lib/api/api.ts` with `defQuery` / `defMutation` / `defAction`.
- `useQuery(api.x.y, args)` returns `data | undefined` (Convex semantics) — pass `"skip"` to disable a conditional query.
- Mutations and actions invalidate the entire query cache by default. That's fine for the current data scale; revisit if perf becomes an issue.

### Storage
- Video files live in R2 under `videos/<uuid>` keys. The `videoStorageId` column on `sessions` stores that key.
- The frontend uploads via a presigned PUT URL (`api.storage.generateUploadUrl`) — bytes go straight to R2, never through our backend.
- `presignRead` falls back to `R2_PUBLIC_BASE_URL` if set; use that if TwelveLabs starts rejecting presigned URLs.

### Testing
- For each new domain route, add a unit test under `server/tests/` with mocked fetch + sql.
- MediaPipe output passed into the API must be validated against the expected landmark schema before use.

# Sports Tutor Hackathon

## What
AI-powered sports coaching web app combining computer vision, LLMs, and video intelligence.
- **Frontend**: React + Vite + TypeScript, hosted on Vercel
- **Backend**: Convex (actions, mutations, queries, storage)
- **CV**: MediaPipe (runs in-browser on uploaded video)
- **APIs**: TwelveLabs (video intelligence), Gemini (coaching feedback)

## Project Structure
See `agent_docs/architecture.md` for a full map of the codebase.
See `agent_docs/convex_patterns.md` for Convex-specific conventions.
See `agent_docs/api_integrations.md` for TwelveLabs and Gemini usage patterns.

## How

### Running the project
```
npm run dev        # starts Vite dev server
npx convex dev     # starts Convex backend (run in parallel)
```

### Type checking & linting
```
npm run typecheck  # tsc --noEmit
npm run lint       # biome check .
npm run lint:fix   # biome check --write .
```
Always run `typecheck` and `lint` after making changes. Fix all errors before considering a task done.

---

## Code Rules

### Error Handling
- All Convex **actions** must wrap external API calls (TwelveLabs, Gemini) in `try/catch` and throw a `ConvexError` with a descriptive message on failure.
- All Convex **mutations** that write to the DB must validate required fields and throw if they are missing or malformed.
- Frontend async calls to Convex must handle errors with `.catch()` or `try/catch` and surface them to the user — never swallow errors silently.

### Schema
- All new Convex tables must have a corresponding entry in `convex/schema.ts`.
- Never write to a table using fields not defined in the schema.
- When adding a field, update the schema first, then the mutation.

### Testing
- For each new Convex action or mutation, add a test case in `convex/tests/` covering: the happy path, a missing/invalid input case, and an external API failure case (mocked).
- MediaPipe output passed into Convex must be validated against the expected landmark schema before use.
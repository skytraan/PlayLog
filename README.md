# PlayLog
AI-powered sports coaching web app.

## Project Structure

```
PlayLog/
├── convex/      # backend — Convex queries, mutations, schema
├── frontend/    # React + Vite + TypeScript (Convex client)
├── src/         # Vite app entry (root-level)
└── package.json # root — Convex backend scripts
```

## Prerequisites
- Node.js 18+
- npm
- A [Convex](https://convex.dev) account

## Backend (Convex)

### Setup

```bash
# Install Convex CLI
npm install

# Log in to Convex (opens browser)
npx convex login

# Initialize your Convex project (first time only)
npx convex dev --configure
```

Then copy and fill in your env:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `CONVEX_DEPLOYMENT` | Your deployment name, e.g. `dev:your-project-name` |

### Running

```bash
npm run backend   # starts Convex dev server
```

## Frontend

### Setup

```bash
cd frontend
npm install
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `VITE_CONVEX_URL` | e.g. `https://your-project-name.convex.cloud` |
| `VITE_CONVEX_SITE_URL` | e.g. `https://your-project-name.convex.site` |
| `VITE_TWELVELABS_API_KEY` | Your TwelveLabs API key |

### Running

```bash
npm run dev   # starts Vite dev server
```

## Running Both Together

In two separate terminals:

```bash
# Terminal 1 — backend
npm run backend

# Terminal 2 — frontend
cd frontend && npm run dev
```

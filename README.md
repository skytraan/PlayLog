# PlayLog
Log your plays.

## Project Structure

```
PlayLog/
├── convex/      # backend — Convex queries, mutations, schema
└── frontend/    # React + Vite + TypeScript
```

## Backend (Convex)

### Setup

```bash
npm install
cp .env.local.example .env.local  # fill in your Convex deployment
```

### Running

```bash
npm run backend
```

## Frontend

### Requirements
- Node.js 18+
- npm

### Setup

```bash
cd frontend
npm install
cp .env.example .env.local  # fill in your Convex URLs
```

### Running

```bash
npm run dev
```

# PlayLog
Log your plays.

## Project Structure

```
PlayLog/
├── frontend/   # React + Vite + TypeScript
└── backend/    # Python + FastAPI
```

## Frontend

### Requirements
- Node.js 18+
- npm

### Setup

```bash
cd frontend
npm install
```

### Running

```bash
# Development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

## Backend

### Requirements
- Python 3.8+

### Setup

```bash
cd backend
python3 -m venv venv
venv/bin/pip install -r requirements.txt
```

### Running

```bash
# Development server (with auto-reload)
venv/bin/uvicorn app.main:app --reload
```

API will be available at `http://localhost:8000`
Auto-generated docs at `http://localhost:8000/docs`

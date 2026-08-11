# Radio Surprise 🎶

A personalised radio web app — upload photos & a song, create a beautiful animated radio, then share a link with someone special.

## Features
- 📸 Upload & drag-to-reorder photos
- 🎵 Upload a song with trim controls + audio preview
- 🎨 6 radio styles × 5 film reel patterns × 7 font pairs
- ✏️ Customise every word on screen
- 🔗 One-click shareable link — anyone can open it

## Quick Start (local)

```bash
npm install
node server.js
# Open http://localhost:3000
```

## Deploy Free on Railway

1. Push this repo to GitHub (no node_modules, no .env, no uploads/, no data/)
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo — Railway auto-detects Node.js and runs `node server.js`
4. Your app gets a public URL like `https://radio-surprise.up.railway.app`

### Optional: Supabase (for persistent storage across deploys)

By default, uploaded files are stored locally — they reset on redeploy. For permanent storage:

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run:
```sql
create table public.radios (
  id uuid primary key,
  config jsonb not null,
  created_at timestamptz default now()
);
```
3. Go to **Storage** → New bucket → Name: `radio-media` → **Public: ON**
4. Go to **Settings → API** → copy Project URL and anon key
5. In Railway → Variables, add:
   - `SUPABASE_URL` = your project URL
   - `SUPABASE_ANON_KEY` = your anon key

## Tech Stack
- Node.js + Express (backend)
- Multer (file uploads)
- Supabase (optional cloud storage)
- Vanilla HTML/CSS/JS (frontend)
# NCM3 Exam — Frontend

Single-page React app that talks to your Supabase Edge Functions (`start-attempt`,
`save-progress`, `submit-attempt`) and renders the student exam + teacher
dashboard for the NC Math 3 EOC Mock — Form A.

## Prerequisites

- **Node.js 18+** (check with `node --version`)
- **npm** (comes with Node)
- A Supabase project with the schema, seed, and three Edge Functions already
  deployed (you've done this already — Phases 2 and 3).

## Local development — run it on your Mac

From a Terminal:

```bash
cd ncm3-frontend
cp .env.example .env
```

Open `.env` in any editor and replace the placeholder values with your real
Supabase URL and anon key. (Already pre-filled with your project's values for
convenience — verify they're right.)

Then:

```bash
npm install     # one time, ~30 seconds
npm run dev     # starts dev server
```

Open [http://localhost:5173](http://localhost:5173) — you should see the cream
landing page.

## How to use it (manual smoke test)

### As a student
1. Enter your name (and optionally an email).
2. Enter exam code: **`FORMA-NCM3`** (or any per-period code you've added).
3. Click **Start exam →**.
4. Answer some questions. The "saved" indicator at the top right confirms
   answers are persisting to the DB. You can refresh the page or close the tab
   and reopen — your answers are restored.
5. Click **Submit** → **Submit final answers**.
6. On the results screen: **Review answers →** walks question by question,
   **↓ Download report** opens a print-friendly view and triggers the browser
   print dialog (Save as PDF from there).

### As a teacher

**One-time setup before first login:**

1. In Supabase dashboard → Authentication → Users → "Add user" → enter your
   email + a password. Confirm the user is created.
2. (Optional) Take ownership of the seeded Form A exam so only you can read
   submissions. In SQL Editor run:
   ```sql
   update public.exams
   set created_by = (select id from auth.users where email = 'YOUR_EMAIL_HERE')
   where created_by is null;
   ```
   Until you do this, *any* authenticated user could read attempts (the seed's
   `created_by IS NULL` permits this for setup convenience). After running the
   UPDATE, only you can see them.

**Then to view results:**

1. From the landing page, click **Teacher login →** (small link at bottom).
2. Sign in with the email + password you created.
3. Dashboard shows: total submissions, cohort average, per-domain cohort
   percentages, and two tabs — Class roster (every submission with score and
   click-to-view) and Item analysis (every question ranked easiest → hardest
   with MCQ distractor distribution).
4. **↓ export CSV** downloads the roster.

## Deploy to Vercel

Once it works locally:

1. Push this folder to a GitHub repo (or use Vercel CLI from local).
2. On vercel.com → New Project → import the repo.
3. Vercel auto-detects Vite. Framework: **Vite**. Build command: `npm run build`.
   Output directory: `dist`.
4. Environment variables (the important step):
   - `VITE_SUPABASE_URL` → your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` → your anon key
5. Deploy. You'll get a URL like `ncm3-exam.vercel.app`.

Share that URL with students. Done.

## Project structure

```
ncm3-frontend/
├── index.html               entry, loads fonts
├── package.json
├── vite.config.js
├── .env.example             env template
└── src/
    ├── main.jsx             React entry
    ├── App.jsx              all screens + routing
    ├── api.js               Supabase client + edge function wrappers
    ├── tokens.js            design tokens (colors, common style fragments)
    ├── math.jsx             KaTeX wrapper
    ├── figures.jsx          all SVG figures for questions
    ├── items.jsx            MCQ / Grid / Match / Order renderers
    └── print.css            print-only stylesheet
```

## Troubleshooting

**"Missing VITE_SUPABASE_URL" in browser console** — `.env` not set up or you
forgot to restart `npm run dev` after editing it.

**"code not recognized"** when starting an exam — the seed didn't run, or the
`exam_codes` table doesn't have `FORMA-NCM3`. Check in Supabase SQL editor:
```sql
select * from public.exam_codes;
```

**401 Unauthorized when starting exam** — Verify JWT is still ON for one of the
Edge Functions. Go to Edge Functions in dashboard, check each function's
settings, turn it off.

**Teacher dashboard is empty after submitting** — RLS may be blocking. If you
ran the `UPDATE exams SET created_by = ...` to claim ownership, make sure you
used the same email you log in with. Or re-set `created_by` to NULL temporarily:
```sql
update public.exams set created_by = null;
```

**KaTeX equations show as raw `$\dfrac{1}{2}$`** — KaTeX CSS didn't load. Check
browser network tab for `katex.min.css` (should be 200).

## What's deferred to later

- Per-question time-on-task analytics view in the dashboard (the data is being
  captured into the `events` table; the UI just isn't built yet).
- Period-based filtering in the teacher dashboard (data is there per row, just
  needs a filter dropdown).
- True drag-and-drop UX for ordering items (currently uses up/down buttons).
- Content-shuffled match/order item types (current security limitation noted
  in earlier discussions).

Tell me which to tackle next.

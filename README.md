# Drug Cliff Radar — Version 2

Version 2 upgrades the original static HTML prototype into a real Vercel/Next.js application with:

- PostgreSQL persistence
- Daily Vercel Cron sync
- openFDA Drugs@FDA application checks for small-molecule drugs
- Competitor-count change detection
- Competition-stage / complexity-moat / beneficiary-impact scoring
- Opportunity history snapshots
- Live "Run FDA sync now" button
- Same Drug Cliff Radar concept, now backed by server-side data

## Important limitation

This is a **research screening system**, not a legal launch-date engine.

The current automated FDA adapter uses openFDA Drugs@FDA records to surface application-level signals. It **does not automatically determine**:
- lawful commercial launch dates
- Paragraph IV settlement terms
- pediatric extensions
- formulation/use patent blocking issues
- Orange Book patent interpretation
- Purple Book biosimilar status (Version 2 flags biologics for later adapter work)
- whether an approved ANDA has actually launched

Those require additional authoritative-source adapters and/or human review.

## Deploy to your existing Vercel project

### 1. Replace the current GitHub repo contents

Keep the same GitHub repository that is already connected to Vercel.

Upload all files/folders in this package to the repository root:
- `app/`
- `lib/`
- `package.json`
- `next.config.js`
- `vercel.json`
- `.gitignore`
- `.env.example`
- `README.md`

Remove the old standalone `index.html` after the new app is committed.

Vercel should detect Next.js automatically.

### 2. Add a PostgreSQL database

Use any PostgreSQL provider with a standard connection string. A simple Vercel-friendly choice is a managed Postgres provider such as Neon.

You need one environment variable:

`DATABASE_URL`

Example:

`postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require`

The app creates its tables and initial seed records automatically on first request.

### 3. Add CRON_SECRET

In Vercel Project Settings → Environment Variables add:

`CRON_SECRET`

Use a long random value.

The daily sync route checks:

`Authorization: Bearer <CRON_SECRET>`

### 4. Deploy

Commit/push the files to the same GitHub repo.

Vercel should rebuild the same project automatically.

### 5. Test the app

Open:

`/api/opportunities`

You should receive JSON with the seeded opportunities.

Then click **Run FDA sync now** on the dashboard.

The daily scheduled job is configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/daily-sync",
      "schedule": "0 12 * * *"
    }
  ]
}
```

Cron expressions on Vercel use UTC. `0 12 * * *` means 12:00 UTC daily.

## What the daily sync currently does

For each small-molecule tracked drug:
1. Searches openFDA Drugs@FDA by generic name.
2. Counts distinct ANDA application numbers visible in the result.
3. Compares that count with yesterday's stored competitor signal.
4. Marks `SCORE DOWN` if the count increases.
5. Saves a historical snapshot.
6. Recalculates Complexity Moat, Beneficiary Impact, and Opportunity Score when the dashboard loads.

For biologics:
- It records the sync timestamp.
- It leaves the current research note intact.
- Purple Book automation is the next adapter to add.

## Version 3 ideas

- Download/parse FDA Orange Book patent + exclusivity files
- Purple Book biosimilar adapter
- First Generic approval adapter
- SEC/financial-data adapter for company revenue and market cap
- Patent litigation / settlement event feed
- Daily email/push digest
- Auth + private user watchlists

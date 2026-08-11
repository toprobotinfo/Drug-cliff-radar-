import { ensureSchema, getOpportunities, saveSnapshot, sql } from "../../../lib/db";
import { fetchOpenFdaDrugApplications, summarizeApplications } from "../../../lib/fda";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request) {
  const manual = new URL(request.url).searchParams.get("manual") === "1";
  if (manual && process.env.NODE_ENV !== "production") return true;

  // For production cron, Vercel sends Authorization: Bearer <CRON_SECRET>.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Allow manual browser test before a secret is configured, but production users
    // should configure CRON_SECRET before relying on the scheduled endpoint.
    return manual;
  }
  return request.headers.get("authorization") === `Bearer ${secret}` || manual;
}

export async function GET(request) {
  if (!authorized(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  await ensureSchema();
  const db = sql();
  const [run] = await db`
    INSERT INTO sync_runs(status, details)
    VALUES ('running', '{}'::jsonb)
    RETURNING id
  `;

  let updated = 0;
  const errors = [];
  try {
    const rows = await getOpportunities();

    for (const x of rows) {
      try {
        // Version 2 automates small-molecule FDA application signals.
        // Purple Book automation is intentionally left for a later adapter.
        if (x.product_type === "biologic") {
          await db`
            UPDATE opportunities
            SET last_fda_sync=NOW(), last_updated=NOW(),
                fda_status=COALESCE(fda_status,'Biologic: Purple Book research required')
            WHERE id=${x.id}
          `;
          await saveSnapshot(x);
          updated++;
          continue;
        }

        const results = await fetchOpenFdaDrugApplications(x.generic_name);
        const summary = summarizeApplications(results);

        const priorCompetitors = Number(x.competitor_count || 0);
        // Use ANDA count as a regulatory-competition signal, not a claim that every ANDA
        // is a lawful commercial competitor today.
        const newCompetitors = summary.andaCount || priorCompetitors;

        let change = "—";
        if (newCompetitors > priorCompetitors) change = "SCORE DOWN";
        if (newCompetitors < priorCompetitors) change = "SCORE UP";

        const fdaStatus = summary.andaCount
          ? `${summary.andaCount} ANDA application(s) visible in openFDA Drugs@FDA; verify approval/launch status and settlements.`
          : `No ANDA applications found in this openFDA query; verify manually.`;

        await db`
          UPDATE opportunities
          SET competitor_count=${newCompetitors},
              fda_status=${fdaStatus},
              change_signal=${change},
              last_fda_sync=NOW(),
              last_updated=NOW()
          WHERE id=${x.id}
        `;

        const [fresh] = await db`SELECT * FROM opportunities WHERE id=${x.id}`;
        await saveSnapshot(fresh);
        updated++;
      } catch (err) {
        errors.push({ id: x.id, drug: x.drug, error: err.message });
      }
    }

    await db`
      UPDATE sync_runs
      SET finished_at=NOW(), status='success',
          details=${db.json({ updated, errors })}
      WHERE id=${run.id}
    `;

    return Response.json({ ok: true, updated, errors });
  } catch (error) {
    await db`
      UPDATE sync_runs
      SET finished_at=NOW(), status='failed',
          details=${db.json({ error: error.message, errors })}
      WHERE id=${run.id}
    `;
    return Response.json({ ok: false, error: error.message, updated, errors }, { status: 500 });
  }
}

import { getOpportunities, latestSync } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await getOpportunities();
    const lastSync = await latestSync();
    return Response.json({ ok: true, rows, lastSync });
  } catch (error) {
    return Response.json({ ok: false, rows: [], error: error.message }, { status: 500 });
  }
}

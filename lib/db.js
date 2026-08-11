import postgres from "postgres";

let client;

export function sql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }
  if (!client) {
    client = postgres(process.env.DATABASE_URL, {
      ssl: "require",
      max: 1,
      idle_timeout: 20
    });
  }
  return client;
}

const seeds = [
  {
    drug:"Keytruda", generic_name:"pembrolizumab", manufacturer:"Merck", ticker:"MRK",
    product_type:"biologic", competition_stage:"Pre-approval / pre-launch",
    expected_launch_date:"2028-12-31", competitor_count:5, annual_sales_b:31.68, remaining_revenue_b:24,
    replication_difficulty:10, manufacturing_difficulty:9, litigation_risk:9, exclusivity_risk:6,
    small_company_access:2, beneficiary_company_revenue_b:10, beneficiary_share_pct:5,
    dosage_form:"IV biologic", fda_status:"Biosimilar programs developing; Purple Book research required.",
    patent_notes:"Verify patent estate, QLEX lifecycle strategy and actual launch restrictions.",
    complexity_evidence:"Biologic with high analytical/manufacturing/regulatory burden.",
    likely_beneficiaries:"Biosimilar developers; MRK downside exposure",
    financial_impact:"Huge revenue-transfer pool but only sophisticated developers are likely to participate."
  },
  {
    drug:"Simponi", generic_name:"golimumab", manufacturer:"Johnson & Johnson", ticker:"JNJ",
    product_type:"biologic", competition_stage:"First generic approved",
    expected_launch_date:"2026-05-15", competitor_count:1, annual_sales_b:2.0, remaining_revenue_b:1.6,
    replication_difficulty:9, manufacturing_difficulty:9, litigation_risk:6, exclusivity_risk:3,
    small_company_access:3, beneficiary_company_revenue_b:1.5, beneficiary_share_pct:15,
    dosage_form:"Injectable biologic", fda_status:"First interchangeable biosimilar approved; verify commercial launch.",
    patent_notes:"Verify commercial launch and additional entrants.",
    complexity_evidence:"Biologic with high manufacturing and analytical requirements; early field remains limited.",
    likely_beneficiaries:"Accord BioPharma / partners",
    financial_impact:"Strong complexity-moat pattern with limited early competition."
  },
  {
    drug:"Eliquis", generic_name:"apixaban", manufacturer:"Bristol Myers Squibb / Pfizer", ticker:"BMY / PFE",
    product_type:"small_molecule", competition_stage:"Pre-approval / pre-launch",
    expected_launch_date:"2028-01-01", competitor_count:25, annual_sales_b:18, remaining_revenue_b:13,
    replication_difficulty:4, manufacturing_difficulty:5, litigation_risk:8, exclusivity_risk:5,
    small_company_access:5, beneficiary_company_revenue_b:5, beneficiary_share_pct:3,
    dosage_form:"Oral tablet", fda_status:"Crowded ANDA field; settlement-dependent launch timing.",
    patent_notes:"Verify Orange Book portfolio and entrant-specific settlement dates.",
    complexity_evidence:"Conventional oral small molecule relative to complex generics; competition is already high.",
    likely_beneficiaries:"Multiple generic manufacturers",
    financial_impact:"Massive market but weak complexity moat because many entrants are positioned."
  },
  {
    drug:"Farxiga", generic_name:"dapagliflozin", manufacturer:"AstraZeneca", ticker:"AZN",
    product_type:"small_molecule", competition_stage:"Generic launched",
    expected_launch_date:"2026-04-06", competitor_count:20, annual_sales_b:7, remaining_revenue_b:3,
    replication_difficulty:4, manufacturing_difficulty:5, litigation_risk:3, exclusivity_risk:2,
    small_company_access:6, beneficiary_company_revenue_b:4, beneficiary_share_pct:3,
    dosage_form:"Oral tablet", fda_status:"Generic commercialization underway.",
    patent_notes:"Verify current competitor count and remaining product-specific protection.",
    complexity_evidence:"Conventional oral small molecule with high ANDA density; little moat remains.",
    likely_beneficiaries:"Approved dapagliflozin generic manufacturers",
    financial_impact:"Useful post-launch case study; not a pristine fresh moat opportunity."
  },
  {
    drug:"Entresto", generic_name:"sacubitril/valsartan", manufacturer:"Novartis", ticker:"NVS",
    product_type:"small_molecule", competition_stage:"Generic launched",
    expected_launch_date:"2025-07-23", competitor_count:18, annual_sales_b:7.75, remaining_revenue_b:3.5,
    replication_difficulty:5, manufacturing_difficulty:5, litigation_risk:5, exclusivity_risk:2,
    small_company_access:6, beneficiary_company_revenue_b:4, beneficiary_share_pct:3,
    dosage_form:"Oral tablet", fda_status:"Generic transition underway with many ANDAs.",
    patent_notes:"Verify remaining formulation/use patents and settlement restrictions.",
    complexity_evidence:"Some formulation/patent complexity, but many entrants mean the practical moat is weak.",
    likely_beneficiaries:"Approved generic entrants",
    financial_impact:"Large revenue transfer in progress; crowding limits per-company upside."
  }
];

function moatScore(x) {
  const rep = Number(x.replication_difficulty || 5);
  const comp = Math.max(0, 10 - Math.min(10, Number(x.competitor_count || 0) / 2));
  const accessPenalty = 11 - Number(x.small_company_access || 5);
  return Math.round((rep * .55 + comp * .30 + accessPenalty * .15) * 10);
}

function beneficiaryImpact(x) {
  const pool = Number(x.remaining_revenue_b || 0);
  const share = Number(x.beneficiary_share_pct || 0) / 100;
  const rev = Number(x.beneficiary_company_revenue_b || 0);
  if (!rev) return 0;
  return Math.max(0, Math.min(100, Math.round((pool * share / rev) * 250)));
}

function stageScore(stage) {
  if (stage === "Generic launched") return 2;
  if (stage === "First generic approved") return 6;
  if (stage === "Biosimilar transition") return 5;
  if (stage === "Long-range patent challenge") return 7;
  return 9;
}

function opportunityScore(x) {
  const comp = Math.max(0, 10 - Math.min(10, Number(x.competitor_count || 0) / 2));
  const stage = stageScore(x.competition_stage);
  const moat = moatScore(x) / 10;
  const benefit = beneficiaryImpact(x) / 10;
  const market = Math.min(10, Math.max(1, Number(x.remaining_revenue_b || 0) / 2));
  const access = Number(x.small_company_access || 5);
  const lit = 11 - Number(x.litigation_risk || 5);
  const ex = 11 - Number(x.exclusivity_risk || 5);
  let timing = 5;
  if (x.expected_launch_date) {
    const days = (new Date(x.expected_launch_date) - new Date()) / 86400000;
    timing = days < 0 ? 3 : days <= 365 ? 10 : days <= 730 ? 9 : days <= 1460 ? 7 : 5;
  }
  return Math.round(((comp*.14+stage*.13)+moat*.18+benefit*.18+market*.12+timing*.10+access*.07+lit*.05+ex*.03)*10);
}

export function withScores(x) {
  return {
    ...x,
    complexity_moat: moatScore(x),
    beneficiary_impact: beneficiaryImpact(x),
    opportunity_score: opportunityScore(x)
  };
}

export async function ensureSchema() {
  const db = sql();
  await db`
    CREATE TABLE IF NOT EXISTS opportunities (
      id BIGSERIAL PRIMARY KEY,
      drug TEXT NOT NULL,
      generic_name TEXT NOT NULL,
      manufacturer TEXT,
      ticker TEXT,
      product_type TEXT NOT NULL DEFAULT 'small_molecule',
      competition_stage TEXT NOT NULL DEFAULT 'Pre-approval / pre-launch',
      expected_launch_date DATE,
      competitor_count INTEGER NOT NULL DEFAULT 0,
      annual_sales_b NUMERIC(12,2),
      remaining_revenue_b NUMERIC(12,2),
      replication_difficulty INTEGER NOT NULL DEFAULT 5,
      manufacturing_difficulty INTEGER NOT NULL DEFAULT 5,
      litigation_risk INTEGER NOT NULL DEFAULT 5,
      exclusivity_risk INTEGER NOT NULL DEFAULT 5,
      small_company_access INTEGER NOT NULL DEFAULT 5,
      beneficiary_company_revenue_b NUMERIC(12,2),
      beneficiary_share_pct NUMERIC(8,2),
      dosage_form TEXT,
      fda_status TEXT,
      patent_notes TEXT,
      complexity_evidence TEXT,
      likely_beneficiaries TEXT,
      financial_impact TEXT,
      change_signal TEXT DEFAULT '—',
      last_fda_sync TIMESTAMPTZ,
      last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(generic_name)
    );
  `;
  await db`
    CREATE TABLE IF NOT EXISTS opportunity_history (
      id BIGSERIAL PRIMARY KEY,
      opportunity_id BIGINT REFERENCES opportunities(id) ON DELETE CASCADE,
      snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      competitor_count INTEGER,
      competition_stage TEXT,
      fda_status TEXT,
      opportunity_score INTEGER,
      complexity_moat INTEGER,
      beneficiary_impact INTEGER,
      change_signal TEXT
    );
  `;
  await db`
    CREATE TABLE IF NOT EXISTS sync_runs (
      id BIGSERIAL PRIMARY KEY,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'running',
      details JSONB
    );
  `;

  const [{ count }] = await db`SELECT COUNT(*)::int AS count FROM opportunities`;
  if (count === 0) {
    for (const x of seeds) {
      await db`
        INSERT INTO opportunities (
          drug,generic_name,manufacturer,ticker,product_type,competition_stage,expected_launch_date,
          competitor_count,annual_sales_b,remaining_revenue_b,replication_difficulty,manufacturing_difficulty,
          litigation_risk,exclusivity_risk,small_company_access,beneficiary_company_revenue_b,
          beneficiary_share_pct,dosage_form,fda_status,patent_notes,complexity_evidence,
          likely_beneficiaries,financial_impact
        ) VALUES (
          ${x.drug},${x.generic_name},${x.manufacturer},${x.ticker},${x.product_type},${x.competition_stage},${x.expected_launch_date},
          ${x.competitor_count},${x.annual_sales_b},${x.remaining_revenue_b},${x.replication_difficulty},${x.manufacturing_difficulty},
          ${x.litigation_risk},${x.exclusivity_risk},${x.small_company_access},${x.beneficiary_company_revenue_b},
          ${x.beneficiary_share_pct},${x.dosage_form},${x.fda_status},${x.patent_notes},${x.complexity_evidence},
          ${x.likely_beneficiaries},${x.financial_impact}
        )
      `;
    }
  }
}

export async function getOpportunities() {
  await ensureSchema();
  const db = sql();
  const rows = await db`SELECT * FROM opportunities ORDER BY drug`;
  return rows.map(withScores);
}

export async function saveSnapshot(x) {
  const db = sql();
  const s = withScores(x);
  await db`
    INSERT INTO opportunity_history (
      opportunity_id, competitor_count, competition_stage, fda_status,
      opportunity_score, complexity_moat, beneficiary_impact, change_signal
    ) VALUES (
      ${x.id},${x.competitor_count},${x.competition_stage},${x.fda_status},
      ${s.opportunity_score},${s.complexity_moat},${s.beneficiary_impact},${x.change_signal || "—"}
    )
  `;
}

export async function latestSync() {
  await ensureSchema();
  const db = sql();
  const rows = await db`
    SELECT finished_at FROM sync_runs
    WHERE status='success'
    ORDER BY finished_at DESC
    LIMIT 1
  `;
  return rows[0]?.finished_at || null;
}

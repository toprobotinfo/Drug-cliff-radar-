"use client";

import { useEffect, useMemo, useState } from "react";

function stageClass(stage) {
  if (stage === "Generic launched") return "launched";
  if (stage === "First generic approved") return "approved";
  if (stage === "Biosimilar transition") return "bio";
  return "pre";
}

function fmtB(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "—";
  return `$${Number(v).toFixed(2)}B`;
}

function clip(text, max = 900) {
  if (!text) return "Not found in the returned FDA label.";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

const QUICK_MEDS = ["sertraline", "fluoxetine", "quetiapine", "lorazepam", "zolpidem", "buspirone"];

export default function Home() {
  const [tab, setTab] = useState("competition");
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ lastSync: null });
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [sort, setSort] = useState("score");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [medQuery, setMedQuery] = useState("sertraline");
  const [medLoading, setMedLoading] = useState(false);
  const [medData, setMedData] = useState(null);
  const [medError, setMedError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/opportunities", { cache: "no-store" });
    const data = await res.json();
    setRows(data.rows || []);
    setMeta({ lastSync: data.lastSync || null });
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let arr = rows.filter((x) => {
      const hay = [x.drug, x.generic_name, x.manufacturer, x.ticker, x.likely_beneficiaries, x.fda_status, x.competition_stage].join(" ").toLowerCase();
      return (!needle || hay.includes(needle)) && (!stage || x.competition_stage === stage);
    });
    arr = [...arr];
    if (sort === "score") arr.sort((a,b) => Number(b.opportunity_score) - Number(a.opportunity_score));
    if (sort === "moat") arr.sort((a,b) => Number(b.complexity_moat) - Number(a.complexity_moat));
    if (sort === "benefit") arr.sort((a,b) => Number(b.beneficiary_impact) - Number(a.beneficiary_impact));
    if (sort === "competition") arr.sort((a,b) => Number(a.competitor_count) - Number(b.competitor_count));
    if (sort === "drug") arr.sort((a,b) => a.drug.localeCompare(b.drug));
    return arr;
  }, [rows, q, stage, sort]);

  const metrics = useMemo(() => ({
    tracked: rows.length,
    highComplexity: rows.filter(x => Number(x.replication_difficulty) >= 8).length,
    launched: rows.filter(x => x.competition_stage === "Generic launched").length,
    topScore: rows.length ? Math.max(...rows.map(x => Number(x.opportunity_score || 0))) : 0,
    topMoat: rows.length ? Math.max(...rows.map(x => Number(x.complexity_moat || 0))) : 0
  }), [rows]);

  async function manualSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/daily-sync?manual=1", { cache: "no-store" });
      const data = await res.json();
      alert(data.ok ? `Sync complete. ${data.updated || 0} records checked.` : data.error || "Sync failed.");
      await load();
    } finally { setSyncing(false); }
  }

  async function lookupMedication(name = medQuery) {
    const value = name.trim();
    if (!value) return;
    setMedQuery(value);
    setMedLoading(true);
    setMedError("");
    try {
      const res = await fetch(`/api/med-safety?drug=${encodeURIComponent(value)}`, { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Lookup failed.");
      setMedData(data);
    } catch (e) {
      setMedData(null);
      setMedError(e.message || "Medication safety lookup failed.");
    } finally { setMedLoading(false); }
  }

  return (
    <main>
      <header className="hero">
        <div>
          <div className="eyebrow">PHARMACEUTICAL COMPETITION + SAFETY INTELLIGENCE</div>
          <h1>Drug Cliff Radar</h1>
          <p className="lead">Track where drug revenue may move — and investigate what FDA safety evidence says about the medications themselves.</p>
        </div>
        {tab === "competition" && <button onClick={manualSync} disabled={syncing}>{syncing ? "Syncing…" : "Run FDA sync now"}</button>}
      </header>

      <nav className="tabs" aria-label="Radar modules">
        <button className={tab === "competition" ? "active" : ""} onClick={() => setTab("competition")}>💰 Competition Radar</button>
        <button className={tab === "safety" ? "active safety" : ""} onClick={() => setTab("safety")}>⚠️ Medication Safety Radar</button>
      </nav>

      {tab === "competition" ? <>
        <section className="metrics">
          <article><b>{metrics.tracked}</b><span>Tracked opportunities</span></article>
          <article><b>{metrics.highComplexity}</b><span>High-complexity</span></article>
          <article><b>{metrics.launched}</b><span>Already launched</span></article>
          <article><b>{metrics.topMoat}</b><span>Top complexity moat</span></article>
          <article><b>{metrics.topScore}</b><span>Top opportunity score</span></article>
        </section>

        <section className="panel controls">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search drug, molecule, company, ticker, beneficiary…" />
          <select value={stage} onChange={e => setStage(e.target.value)}><option value="">All competition stages</option><option>Pre-approval / pre-launch</option><option>First generic approved</option><option>Generic launched</option><option>Biosimilar transition</option><option>Long-range patent challenge</option></select>
          <select value={sort} onChange={e => setSort(e.target.value)}><option value="score">Highest opportunity score</option><option value="moat">Highest complexity moat</option><option value="benefit">Highest beneficiary impact</option><option value="competition">Fewest competitors</option><option value="drug">Drug A–Z</option></select>
        </section>

        <section className="syncbar"><span>Last database sync: <strong>{meta.lastSync ? new Date(meta.lastSync).toLocaleString() : "Not synced yet"}</strong></span><span>Automatic schedule: <strong>daily</strong></span></section>

        <section className="panel tablewrap"><div className="table"><div className="thead"><span>Drug</span><span>Ticker</span><span>Stage</span><span>Competitors</span><span>Brand sales</span><span>Remaining revenue</span><span>Replication</span><span>Complexity moat</span><span>Beneficiary impact</span><span>Opportunity score</span><span>FDA signal</span><span>Change</span></div>{loading ? <div className="loading">Loading database…</div> : shown.map(x => <button className="tr" key={x.id} onClick={() => setDetail(x)}><span><strong>{x.drug}</strong><small>{x.generic_name}<br/>{x.manufacturer}</small></span><span className="ticker">{x.ticker || "—"}</span><span><em className={`stage ${stageClass(x.competition_stage)}`}>{x.competition_stage}</em></span><span><strong>{x.competitor_count}</strong><small>ANDA/BLA field estimate</small></span><span><strong>{fmtB(x.annual_sales_b)}</strong></span><span><strong>{fmtB(x.remaining_revenue_b)}</strong></span><span><strong>{x.replication_difficulty}/10</strong></span><span className="moat">{x.complexity_moat}</span><span className="benefit">{x.beneficiary_impact}</span><span className="score">{x.opportunity_score}</span><span><small>{x.fda_status || "Research"}</small></span><span><small className="change">{x.change_signal || "—"}</small></span></button>)}</div></section>

        <section className="two"><article className="panel pad"><div className="eyebrow">MOMENTA-PATTERN DETECTOR</div><h2>What makes the Radar scream</h2><p>High revenue + high replication difficulty + low competitor count + lawful launch approaching + one identifiable beneficiary + opportunity large relative to that company.</p><div className="logic"><span>Replication Difficulty</span><span>Complexity Moat</span><span>Beneficiary Impact</span><span>Competition Stage</span></div></article><article className="panel pad"><div className="eyebrow">AUTOMATION STATUS</div><h2>Version 2 data engine</h2><p>Small-molecule opportunities can automatically query openFDA Drugs@FDA records each day. Biologics remain flagged for Purple Book/manual research until the Purple Book adapter is added.</p><p className="fine">Important: an ANDA count or FDA approval does not by itself establish a lawful commercial launch date.</p></article></section>
      </> : <>
        <section className="safetyHero panel pad">
          <div className="eyebrow warning">MEDICATION SAFETY RADAR</div>
          <h2>What does the FDA evidence actually say?</h2>
          <p>Search a brand or generic drug. The Radar checks the public FDA prescribing-label dataset and FAERS adverse-event reports, then keeps label evidence separate from post-marketing reporting signals.</p>
          <form className="medSearch" onSubmit={e => { e.preventDefault(); lookupMedication(); }}>
            <input value={medQuery} onChange={e => setMedQuery(e.target.value)} placeholder="Try sertraline, Zoloft, quetiapine…" />
            <button disabled={medLoading}>{medLoading ? "Checking FDA…" : "Check medication"}</button>
          </form>
          <div className="quickMeds">{QUICK_MEDS.map(name => <button key={name} onClick={() => lookupMedication(name)}>{name}</button>)}</div>
          <p className="fine"><strong>Important:</strong> FAERS reports are signals, not proof that a medication caused an event. Report counts cannot be used as incidence rates and can be affected by reporting bias, duplicates, underlying illness, other medications, and many other factors.</p>
        </section>

        {medError && <section className="panel pad errorBox">{medError}</section>}
        {medData && <>
          <section className="medIdentity">
            <article className="panel pad"><span className="label">Medication</span><h2>{medData.medication.genericName}</h2><p>{medData.medication.brandNames?.length ? medData.medication.brandNames.join(", ") : "Brand name not returned"}</p></article>
            <article className="panel pad"><span className="label">Manufacturer in label</span><h3>{medData.medication.manufacturer || "Not returned"}</h3><p>{medData.medication.productType || "FDA label record"}</p></article>
            <article className="panel pad"><span className="label">Evidence split</span><h3>Label ≠ FAERS signal</h3><p>Established labeling is shown separately from spontaneous adverse-event reports.</p></article>
          </section>

          <section className="safetyGrid">
            <article className="panel pad danger"><div className="eyebrow warning">HIGHEST-PRIORITY LABELING</div><h3>Boxed warning</h3><p>{clip(medData.label?.boxedWarning, 1200)}</p></article>
            <article className="panel pad"><div className="eyebrow">FDA LABEL</div><h3>Warnings & precautions</h3><p>{clip(medData.label?.warnings, 1400)}</p></article>
            <article className="panel pad"><div className="eyebrow">FDA LABEL</div><h3>Adverse reactions</h3><p>{clip(medData.label?.adverseReactions, 1400)}</p></article>
            <article className="panel pad"><div className="eyebrow">FDA LABEL</div><h3>Drug interactions</h3><p>{clip(medData.label?.drugInteractions, 1100)}</p></article>
            <article className="panel pad"><div className="eyebrow">FDA LABEL</div><h3>Pregnancy / specific populations</h3><p>{clip(medData.label?.pregnancy, 1100)}</p></article>
            <article className="panel pad"><div className="eyebrow">FDA LABEL</div><h3>Indications</h3><p>{clip(medData.label?.indications, 1000)}</p></article>
          </section>

          {medData.everydaySubstances && <section className="panel pad substancePanel">
            <div className="eyebrow warning">EVERYDAY SUBSTANCE INTERACTIONS</div>
            <h2>Was this actually tested?</h2>
            <p className="fine">This panel distinguishes direct FDA-label evidence from mechanism-based concern and evidence gaps. “Not found in the returned label” does not mean “safe” or “no interaction.”</p>
            <div className="substanceGrid">
              {[
                ["🍷 Alcohol", medData.everydaySubstances.alcohol],
                ["🌿 Cannabis / THC / CBD", medData.everydaySubstances.cannabis],
                ["🚬 Tobacco / nicotine", medData.everydaySubstances.tobaccoNicotine],
                ["☕ Caffeine", medData.everydaySubstances.caffeine]
              ].map(([name, item]) => <article key={name}>
                <h3>{name}</h3>
                <div className={`evidencePill ${item.labelMention ? "found" : "gap"}`}>{item.tested}</div>
                <p>{item.note}</p>
                <dl><div><dt>Evidence type</dt><dd>{item.evidence}</dd></div><div><dt>Strength</dt><dd>{item.level}</dd></div></dl>
              </article>)}
            </div>
          </section>}

          <section className="panel pad faers">
            <div className="eyebrow warning">FAERS POST-MARKETING SIGNALS</div>
            <h2>Most frequently reported reaction terms in matching reports</h2>
            <p className="fine">These are spontaneous report counts associated with the medication search — not proof of causation, not a ranking of true side-effect frequency, and not a comparison against untreated patients.</p>
            {medData.faersTopReactions?.length ? <div className="reactionList">{medData.faersTopReactions.map((r, i) => <div key={`${r.term}-${i}`}><span>{r.term}</span><b>{Number(r.count).toLocaleString()} reports</b></div>)}</div> : <p>No matching reaction-count results were returned.</p>}
          </section>

          <section className="two"><article className="panel pad"><div className="eyebrow">FOR THE SHOW</div><h2>A safer way to tell the story</h2><p>Ask: “What was prescribed? What does the FDA label warn about? What signals appear in FAERS? What other explanations or confounders exist? What evidence would be needed to claim causation?”</p></article><article className="panel pad"><div className="eyebrow">SOURCE</div><h2>Live public FDA data</h2><p>{medData.source}</p><p className="fine">Medication information is educational research, not individualized medical advice. Do not stop or change a prescription based on this dashboard.</p></article></section>
        </>}
      </>}

      {detail && <div className="overlay" onMouseDown={() => setDetail(null)}><article className="modal" onMouseDown={e => e.stopPropagation()}><button className="close" onClick={() => setDetail(null)}>×</button><div className="eyebrow">{detail.change_signal || "OPPORTUNITY DETAIL"}</div><h2>{detail.drug} / {detail.generic_name}</h2><p><strong>{detail.manufacturer}</strong> · {detail.ticker || "No ticker mapped"}</p><div className="detailgrid"><div><b>{detail.competitor_count}</b><span>Competitors</span></div><div><b>{detail.replication_difficulty}/10</b><span>Replication difficulty</span></div><div><b>{detail.complexity_moat}</b><span>Complexity moat</span></div><div><b>{detail.beneficiary_impact}</b><span>Beneficiary impact</span></div><div><b>{detail.opportunity_score}</b><span>Opportunity score</span></div><div><b>{fmtB(detail.remaining_revenue_b)}</b><span>Remaining revenue</span></div></div><h3>FDA / legal status</h3><p>{detail.fda_status || "Research needed."}</p><h3>Patent / exclusivity notes</h3><p>{detail.patent_notes || "Research needed."}</p><h3>Complexity evidence</h3><p>{detail.complexity_evidence || "Research needed."}</p><h3>Likely beneficiaries</h3><p>{detail.likely_beneficiaries || "Research needed."}</p><h3>Financial impact</h3><p>{detail.financial_impact || "Research needed."}</p></article></div>}

      <footer>Research screening only; not legal, regulatory, medical, or investment advice. Verify patents, exclusivities, settlements, litigation, launch rights, prescribing information, and safety evidence before decisions.</footer>
    </main>
  );
}

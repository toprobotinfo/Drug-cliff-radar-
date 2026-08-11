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

export default function Home() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ lastSync: null });
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [sort, setSort] = useState("score");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [syncing, setSyncing] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/opportunities", { cache: "no-store" });
    const data = await res.json();
    setRows(data.rows || []);
    setMeta({ lastSync: data.lastSync || null });
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let arr = rows.filter((x) => {
      const hay = [
        x.drug, x.generic_name, x.manufacturer, x.ticker,
        x.likely_beneficiaries, x.fda_status, x.competition_stage
      ].join(" ").toLowerCase();
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
    } finally {
      setSyncing(false);
    }
  }

  return (
    <main>
      <header className="hero">
        <div>
          <div className="eyebrow">COMPETITION-TIMING + COMPLEXITY INTELLIGENCE</div>
          <h1>Drug Cliff Radar</h1>
          <p className="lead">Who can legally launch, when, against how many competitors, how hard was the drug to replicate, and how much could the winner matter?</p>
        </div>
        <button onClick={manualSync} disabled={syncing}>
          {syncing ? "Syncing…" : "Run FDA sync now"}
        </button>
      </header>

      <section className="metrics">
        <article><b>{metrics.tracked}</b><span>Tracked opportunities</span></article>
        <article><b>{metrics.highComplexity}</b><span>High-complexity</span></article>
        <article><b>{metrics.launched}</b><span>Already launched</span></article>
        <article><b>{metrics.topMoat}</b><span>Top complexity moat</span></article>
        <article><b>{metrics.topScore}</b><span>Top opportunity score</span></article>
      </section>

      <section className="panel controls">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search drug, molecule, company, ticker, beneficiary…" />
        <select value={stage} onChange={e => setStage(e.target.value)}>
          <option value="">All competition stages</option>
          <option>Pre-approval / pre-launch</option>
          <option>First generic approved</option>
          <option>Generic launched</option>
          <option>Biosimilar transition</option>
          <option>Long-range patent challenge</option>
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)}>
          <option value="score">Highest opportunity score</option>
          <option value="moat">Highest complexity moat</option>
          <option value="benefit">Highest beneficiary impact</option>
          <option value="competition">Fewest competitors</option>
          <option value="drug">Drug A–Z</option>
        </select>
      </section>

      <section className="syncbar">
        <span>Last database sync: <strong>{meta.lastSync ? new Date(meta.lastSync).toLocaleString() : "Not synced yet"}</strong></span>
        <span>Automatic schedule: <strong>daily</strong></span>
      </section>

      <section className="panel tablewrap">
        <div className="table">
          <div className="thead">
            <span>Drug</span><span>Ticker</span><span>Stage</span><span>Competitors</span>
            <span>Brand sales</span><span>Remaining revenue</span><span>Replication</span>
            <span>Complexity moat</span><span>Beneficiary impact</span><span>Opportunity score</span>
            <span>FDA signal</span><span>Change</span>
          </div>
          {loading ? <div className="loading">Loading database…</div> : shown.map(x => (
            <button className="tr" key={x.id} onClick={() => setDetail(x)}>
              <span><strong>{x.drug}</strong><small>{x.generic_name}<br/>{x.manufacturer}</small></span>
              <span className="ticker">{x.ticker || "—"}</span>
              <span><em className={`stage ${stageClass(x.competition_stage)}`}>{x.competition_stage}</em></span>
              <span><strong>{x.competitor_count}</strong><small>ANDA/BLA field estimate</small></span>
              <span><strong>{fmtB(x.annual_sales_b)}</strong></span>
              <span><strong>{fmtB(x.remaining_revenue_b)}</strong></span>
              <span><strong>{x.replication_difficulty}/10</strong></span>
              <span className="moat">{x.complexity_moat}</span>
              <span className="benefit">{x.beneficiary_impact}</span>
              <span className="score">{x.opportunity_score}</span>
              <span><small>{x.fda_status || "Research"}</small></span>
              <span><small className="change">{x.change_signal || "—"}</small></span>
            </button>
          ))}
        </div>
      </section>

      <section className="two">
        <article className="panel pad">
          <div className="eyebrow">MOMENTA-PATTERN DETECTOR</div>
          <h2>What makes the Radar scream</h2>
          <p>High revenue + high replication difficulty + low competitor count + lawful launch approaching + one identifiable beneficiary + opportunity large relative to that company.</p>
          <div className="logic">
            <span>Replication Difficulty</span><span>Complexity Moat</span><span>Beneficiary Impact</span><span>Competition Stage</span>
          </div>
        </article>
        <article className="panel pad">
          <div className="eyebrow">AUTOMATION STATUS</div>
          <h2>Version 2 data engine</h2>
          <p>Small-molecule opportunities can automatically query openFDA Drugs@FDA records each day. Biologics remain flagged for Purple Book/manual research until the Purple Book adapter is added.</p>
          <p className="fine">Important: an ANDA count or FDA approval does not by itself establish a lawful commercial launch date.</p>
        </article>
      </section>

      {detail && (
        <div className="overlay" onMouseDown={() => setDetail(null)}>
          <article className="modal" onMouseDown={e => e.stopPropagation()}>
            <button className="close" onClick={() => setDetail(null)}>×</button>
            <div className="eyebrow">{detail.change_signal || "OPPORTUNITY DETAIL"}</div>
            <h2>{detail.drug} / {detail.generic_name}</h2>
            <p><strong>{detail.manufacturer}</strong> · {detail.ticker || "No ticker mapped"}</p>
            <div className="detailgrid">
              <div><b>{detail.competitor_count}</b><span>Competitors</span></div>
              <div><b>{detail.replication_difficulty}/10</b><span>Replication difficulty</span></div>
              <div><b>{detail.complexity_moat}</b><span>Complexity moat</span></div>
              <div><b>{detail.beneficiary_impact}</b><span>Beneficiary impact</span></div>
              <div><b>{detail.opportunity_score}</b><span>Opportunity score</span></div>
              <div><b>{fmtB(detail.remaining_revenue_b)}</b><span>Remaining revenue</span></div>
            </div>
            <h3>FDA / legal status</h3><p>{detail.fda_status || "Research needed."}</p>
            <h3>Patent / exclusivity notes</h3><p>{detail.patent_notes || "Research needed."}</p>
            <h3>Complexity evidence</h3><p>{detail.complexity_evidence || "Research needed."}</p>
            <h3>Likely beneficiaries</h3><p>{detail.likely_beneficiaries || "Research needed."}</p>
            <h3>Financial impact</h3><p>{detail.financial_impact || "Research needed."}</p>
          </article>
        </div>
      )}

      <footer>Research screening only; not legal, regulatory, or investment advice. Verify patents, exclusivities, settlements, litigation and actual commercial launch rights before decisions.</footer>
    </main>
  );
}

export async function fetchOpenFdaDrugApplications(genericName) {
  const query = encodeURIComponent(`openfda.generic_name:"${genericName}"`);
  const url = `https://api.fda.gov/drug/drugsfda.json?search=${query}&limit=100`;
  const res = await fetch(url, {
    headers: { "user-agent": "Drug-Cliff-Radar/2.0" },
    cache: "no-store"
  });

  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`openFDA ${res.status}`);
  const json = await res.json();
  return json.results || [];
}

export function summarizeApplications(results) {
  const applications = new Map();

  for (const r of results) {
    const app = r.application_number || "";
    if (!app) continue;
    applications.set(app, {
      application_number: app,
      sponsor_name: r.sponsor_name || null,
      products: r.products || []
    });
  }

  const all = [...applications.values()];
  const andas = all.filter(x => /^ANDA/i.test(x.application_number));
  const ndas = all.filter(x => /^NDA/i.test(x.application_number));
  const blas = all.filter(x => /^BLA/i.test(x.application_number));

  return {
    applicationCount: all.length,
    andaCount: andas.length,
    ndaCount: ndas.length,
    blaCount: blas.length,
    sponsors: [...new Set(all.map(x => x.sponsor_name).filter(Boolean))],
    applications: all
  };
}

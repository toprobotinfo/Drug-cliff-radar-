import { NextResponse } from "next/server";

const FDA = "https://api.fda.gov";

function cleanDrug(input = "") {
  return input.trim().replace(/[\"\\]/g, "").slice(0, 80);
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Drug-Cliff-Radar/2.1" },
    cache: "no-store"
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`openFDA request failed (${res.status})`);
  }
  return res.json();
}

function firstArrayValue(obj, key) {
  const value = obj?.[key];
  if (!Array.isArray(value) || !value.length) return null;
  return value[0];
}


function analyzeEverydaySubstances(label = {}) {
  const interactions = [
    firstArrayValue(label, "drug_interactions"),
    firstArrayValue(label, "warnings_and_cautions"),
    firstArrayValue(label, "warnings"),
    firstArrayValue(label, "clinical_pharmacology"),
    firstArrayValue(label, "pharmacokinetics")
  ].filter(Boolean).join(" ").toLowerCase();

  const has = (...terms) => terms.some(t => interactions.includes(t));
  const classify = ({directTerms=[], mechanismTerms=[]}) => {
    const direct = directTerms.some(t => interactions.includes(t));
    const mechanism = mechanismTerms.some(t => interactions.includes(t));
    if (direct) return { tested: "Mentioned in FDA labeling", evidence: "Label evidence", level: "Moderate–Strong" };
    if (mechanism) return { tested: "Mechanism suggests possible interaction", evidence: "Mechanistic / label inference", level: "Limited–Moderate" };
    return { tested: "No direct study found in returned FDA label", evidence: "Evidence gap", level: "Unknown / limited" };
  };

  return {
    alcohol: {
      ...classify({ directTerms:["alcohol","ethanol"], mechanismTerms:["central nervous system depress","sedation","somnolence","hepatic","liver"] }),
      labelMention: has("alcohol","ethanol"),
      note: has("alcohol","ethanol") ? "FDA labeling returned a direct alcohol/ethanol reference." : "The returned FDA label did not contain a direct alcohol/ethanol interaction statement."
    },
    cannabis: {
      ...classify({ directTerms:["cannabis","marijuana","tetrahydrocannabinol","thc","cannabidiol","cbd"], mechanismTerms:["cyp3a4","cyp2c19","cyp2d6","cyp1a2","sedation","somnolence"] }),
      labelMention: has("cannabis","marijuana","tetrahydrocannabinol","thc","cannabidiol","cbd"),
      note: has("cannabis","marijuana","tetrahydrocannabinol","thc","cannabidiol","cbd") ? "FDA labeling returned a cannabis/THC/CBD reference." : "Direct cannabis/THC/CBD interaction data were not found in the returned FDA label; mechanism-based interaction potential may still exist."
    },
    tobaccoNicotine: {
      ...classify({ directTerms:["tobacco","smoking","nicotine","cigarette"], mechanismTerms:["cyp1a2"] }),
      labelMention: has("tobacco","smoking","nicotine","cigarette"),
      note: has("tobacco","smoking","nicotine","cigarette") ? "FDA labeling returned a smoking/tobacco/nicotine reference." : "The returned FDA label did not contain a direct smoking/tobacco/nicotine interaction statement."
    },
    caffeine: {
      ...classify({ directTerms:["caffeine","coffee"], mechanismTerms:["cyp1a2","stimulant"] }),
      labelMention: has("caffeine","coffee"),
      note: has("caffeine","coffee") ? "FDA labeling returned a caffeine/coffee reference." : "The returned FDA label did not contain a direct caffeine/coffee interaction statement."
    }
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const drug = cleanDrug(searchParams.get("drug") || "");
  if (!drug) {
    return NextResponse.json({ ok: false, error: "Enter a medication name." }, { status: 400 });
  }

  const escaped = drug.replace(/ /g, "+");
  const labelSearch = encodeURIComponent(`openfda.generic_name:\"${drug}\" OR openfda.brand_name:\"${drug}\"`);
  const eventSearch = encodeURIComponent(`patient.drug.openfda.generic_name:\"${drug}\" OR patient.drug.openfda.brand_name:\"${drug}\"`);

  try {
    const [labels, reactions] = await Promise.all([
      fetchJson(`${FDA}/drug/label.json?search=${labelSearch}&limit=5`),
      fetchJson(`${FDA}/drug/event.json?search=${eventSearch}&count=patient.reaction.reactionmeddrapt.exact&limit=12`)
    ]);

    const label = labels?.results?.[0] || null;
    const openfda = label?.openfda || {};

    return NextResponse.json({
      ok: true,
      query: drug,
      medication: {
        genericName: firstArrayValue(openfda, "generic_name") || drug,
        brandNames: openfda.brand_name || [],
        manufacturer: firstArrayValue(openfda, "manufacturer_name"),
        route: openfda.route || [],
        productType: firstArrayValue(openfda, "product_type"),
        effectiveTime: label?.effective_time || null
      },
      label: label ? {
        boxedWarning: firstArrayValue(label, "boxed_warning"),
        warnings: firstArrayValue(label, "warnings_and_cautions") || firstArrayValue(label, "warnings"),
        adverseReactions: firstArrayValue(label, "adverse_reactions"),
        indications: firstArrayValue(label, "indications_and_usage"),
        pregnancy: firstArrayValue(label, "pregnancy") || firstArrayValue(label, "use_in_specific_populations"),
        drugInteractions: firstArrayValue(label, "drug_interactions"),
        pharmacology: firstArrayValue(label, "clinical_pharmacology"),
        metabolism: firstArrayValue(label, "pharmacokinetics")
      } : null,
      faersTopReactions: Array.isArray(reactions?.results)
        ? reactions.results.map((x) => ({ term: x.term, count: x.count }))
        : [],
      everydaySubstances: label ? analyzeEverydaySubstances(label) : null,
      evidence: {
        label: label ? "FDA prescribing-label evidence" : "No matching FDA label returned",
        faers: reactions?.results?.length
          ? "FAERS reporting signal only — reports can be incomplete, duplicated, confounded, and do not prove the drug caused the event or show incidence."
          : "No matching FAERS reaction counts returned."
      },
      source: "openFDA Drug Label + FAERS public APIs"
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || "Medication safety lookup failed." }, { status: 500 });
  }
}

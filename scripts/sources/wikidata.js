// ===== Wikidata Website Finder =====
// Queries Wikidata for official websites of venues
// Free, no API key, no rate limits (be polite with delays)

const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';

async function findWebsites(venues) {
  if (!venues || venues.length === 0) return {};

  console.log(`[wikidata] Looking up websites for ${venues.length} venues...`);
  const results = {};
  let found = 0;

  // Batch venues: 20 per query to keep SPARQL fast
  const BATCH = 20;
  for (let i = 0; i < venues.length; i += BATCH) {
    const batch = venues.slice(i, i + BATCH);

    // Build SPARQL query: for each venue name, search for matching Wikidata item
    const values = batch.map((v, j) => {
      const name = (v.name || '').replace(/"/g, '\\"');
      const city = (v.city || '').replace(/"/g, '\\"');
      return `("${name}"@it "${city}"@it)`;
    }).join('\n');

    const query = `SELECT ?item ?itemLabel ?website ?cityLabel WHERE {
  VALUES (?name ?city) { ${values} }
  ?item rdfs:label ?name.
  ?item wdt:P856 ?website.
  OPTIONAL { ?item wdt:P131 ?cityItem. ?cityItem rdfs:label ?cityLabel. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }
}
LIMIT ${BATCH * 2}`;

    try {
      const url = `${WIKIDATA_SPARQL}?format=json&query=${encodeURIComponent(query)}`;
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'CosaFacciamoStasera/1.0' },
      });

      if (!resp.ok) {
        console.error(`[wikidata] HTTP ${resp.status}`);
        await sleep(1000);
        continue;
      }

      const data = await resp.json();
      const bindings = data?.results?.bindings || [];

      for (const b of bindings) {
        const label = b.itemLabel?.value?.toLowerCase() || '';
        const website = b.website?.value || '';
        if (!website) continue;

        // Match against batch venues
        for (const v of batch) {
          const vn = (v.name || '').toLowerCase();
          if (label.includes(vn) || vn.includes(label)) {
            const url = normalizeUrl(website);
            if (url && !results[v.id]) {
              results[v.id] = url;
              found++;
            }
            break;
          }
        }
      }
    } catch (err) {
      console.error(`[wikidata] Error: ${err.message}`);
    }

    await sleep(1500); // Respect rate limits
  }

  console.log(`[wikidata] Found ${found} websites`);
  return results;
}

function normalizeUrl(url) {
  if (!url) return null;
  url = url.trim();
  if (!url.startsWith('http')) url = 'https://' + url;
  try { new URL(url); return url; } catch { return null; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { findWebsites };

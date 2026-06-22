// ===== Gemini Plan Generator for collector =====
const { fetchVenuesForCity } = require('./overpass');
const fs = require('fs');
const path = require('path');

const TOP_CITIES = [
  { name: 'Roma', lat: 41.9028, lng: 12.4964 },
  { name: 'Milano', lat: 45.4642, lng: 9.1900 },
  { name: 'Napoli', lat: 40.8518, lng: 14.2681 },
  { name: 'Torino', lat: 45.0703, lng: 7.6869 },
  { name: 'Bologna', lat: 44.4949, lng: 11.3426 },
  { name: 'Firenze', lat: 43.7696, lng: 11.2558 },
  { name: 'Palermo', lat: 38.1157, lng: 13.3615 },
  { name: 'Bari', lat: 41.1171, lng: 16.8719 },
  { name: 'Genova', lat: 44.4056, lng: 8.9463 },
  { name: 'Venezia', lat: 45.4408, lng: 12.3155 },
  { name: 'Verona', lat: 45.4384, lng: 10.9916 },
  { name: 'Catania', lat: 37.5079, lng: 15.0918 },
  { name: 'Rimini', lat: 44.0594, lng: 12.5653 },
  { name: 'Lecce', lat: 40.3516, lng: 18.1718 },
  { name: 'Perugia', lat: 43.1107, lng: 12.3908 },
];

async function generatePlans(apiKey, events, plansDir) {
  if (!apiKey || apiKey === 'YOUR_KEY_HERE') {
    console.log('[gemini] No API key – skipping plan generation');
    return;
  }

  fs.mkdirSync(plansDir, { recursive: true });
  let count = 0;

  for (const city of TOP_CITIES) {
    try {
      const venues = await fetchVenuesForCity(city, 15);
      const cityEvents = events.filter(e => {
        const cn = (e.city || '').toLowerCase();
        return cn.includes(city.name.toLowerCase()) || city.name.toLowerCase().includes(cn);
      });

      if (venues.length === 0 && cityEvents.length === 0) continue;

      const venueList = venues.slice(0, 12).map(v => `- ${v.name} (${v.type})`).join('\n');
      const eventList = cityEvents.slice(0, 8).map(e =>
        `- ${e.name} al ${e.venue} il ${e.date}${e.priceMin ? ', da ' + e.priceMin + '€' : ''}`
      ).join('\n');

      const prompt = `Sei un esperto di vita notturna italiana. Basandoti su questi locali ed eventi a ${city.name}, scrivi un PROGRAMMA PER STASERA in 2-3 tappe (aperitivo → cena → dopo cena). Tono entusiasta e informale, massimo 200 parole, solo testo con emoji, niente markdown.

LOCALI A ${city.name.toUpperCase()}:
${venueList || '(nessun locale)'}

EVENTI:
${eventList || '(nessun evento)'}

IL PROGRAMMA PER STASERA A ${city.name.toUpperCase()}:`;

      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 350 },
        }),
      });

      if (!resp.ok) {
        console.error(`[gemini] API error for ${city.name}: ${resp.status}`);
        await sleep(2000);
        continue;
      }

      const data = await resp.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        const safeName = city.name.toLowerCase().replace(/\s+/g, '-');
        fs.writeFileSync(
          path.join(plansDir, `${safeName}.json`),
          JSON.stringify({ city: city.name, plan: text, updated: new Date().toISOString() }, null, 2)
        );
        count++;
        console.log(`[gemini] Plan generated for ${city.name}`);
      }

      await sleep(1500);
    } catch (err) {
      console.error(`[gemini] Error for ${city.name}: ${err.message}`);
    }
  }

  console.log(`[gemini] Generated ${count} city plans`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { generatePlans };

// ===== Gemini Plan Generator for collector =====
// Generates 3 plan variants per city (party / culture / foodie)
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

const PLAN_TYPES = {
  party: {
    emoji: '🪩',
    label: 'Party',
    types: ['nightclub', 'bar', 'pub', 'live_music'],
    prompt: 'Crea un piano serata FESTAIOLO: solo discoteche, pub e musica dal vivo. Tono energico.',
  },
  culture: {
    emoji: '🎭',
    label: 'Cultura',
    types: ['cinema', 'theatre', 'live_music', 'events_venue'],
    prompt: 'Crea un piano serata CULTURALE: cinema, teatri e musica dal vivo. Tono elegante e raffinato.',
  },
  foodie: {
    emoji: '🍝',
    label: 'Food & Drink',
    types: ['restaurant', 'bar', 'pub'],
    prompt: 'Crea un piano serata FOODIE: aperitivo, ristoranti e pub. Tono da buongustaio.',
  },
};

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

      const allVenues = venues.slice(0, 20);
      const allEvents = cityEvents.slice(0, 10);
      const venueList = allVenues.map(v => `- ${v.name} (${v.type})`).join('\n');
      const eventList = allEvents.map(e =>
        `- ${e.name} al ${e.venue} il ${e.date}${e.priceMin ? ', da ' + e.priceMin + '€' : ''}`
      ).join('\n');

      const plans = {};

      for (const [key, pt] of Object.entries(PLAN_TYPES)) {
        const filteredVenues = allVenues.filter(v => pt.types.includes(v.type));
        const fvList = filteredVenues.map(v => `- ${v.name} (${v.type})`).join('\n');

        const prompt = `Sei un esperto di vita notturna. ${pt.prompt} Scrivi un programma in 2-3 tappe per stasera a ${city.name}. Massimo 150 parole, italiano informale con emoji, niente markdown.

LOCALI:
${fvList || venueList}

EVENTI:
${eventList || '(nessun evento)'}

IL PROGRAMMA ${pt.label.toUpperCase()} PER STASERA A ${city.name.toUpperCase()}:`;

        try {
          const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.9, maxOutputTokens: 300 },
            }),
          });

          if (!resp.ok) {
            console.error(`[gemini] API error ${city.name}/${key}: ${resp.status}`);
            await sleep(1000);
            continue;
          }

          const data = await resp.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            plans[key] = { emoji: pt.emoji, label: pt.label, text };
            count++;
            console.log(`[gemini] ✓ ${city.name} - ${pt.label}`);
          }
          await sleep(1500);
        } catch (err) {
          console.error(`[gemini] ${city.name}/${key}: ${err.message}`);
        }
      }

      if (Object.keys(plans).length > 0) {
        const safeName = city.name.toLowerCase().replace(/\s+/g, '-');
        fs.writeFileSync(
          path.join(plansDir, `${safeName}.json`),
          JSON.stringify({ city: city.name, plans, updated: new Date().toISOString() }, null, 2)
        );
      }

    } catch (err) {
      console.error(`[gemini] Error for ${city.name}: ${err.message}`);
    }
  }

  console.log(`[gemini] Generated ${count} plan variants across ${TOP_CITIES.length} cities`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { generatePlans };

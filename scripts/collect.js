// ===== Data Collector =====
// Runs via GitHub Actions (2x/day) or manually: node scripts/collect.js
// Merges Google Places + Ticketmaster + Songkick into per-city JSON files + events.json
const fs = require('fs');
const path = require('path');
const { fetchGooglePlaces } = require('./sources/google');
const { fetchTicketmasterEvents } = require('./sources/events');
const { fetchSongkickEvents } = require('./sources/songkick');
const { generatePlans } = require('./sources/gemini');
const { findWebsites } = require('./sources/wikidata');

const DATA_DIR = path.join(__dirname, '..', 'data', 'cities');
const EVENTS_FILE = path.join(__dirname, '..', 'data', 'events.json');
const PLANS_DIR = path.join(__dirname, '..', 'data', 'plans');

async function main() {
  console.log('=== Cosa facciamo stasera? – Data Collector ===');
  console.log(`Started: ${new Date().toISOString()}\n`);

  const googleKey = process.env.GOOGLE_API_KEY || '';
  const ticketmasterKey = process.env.TICKETMASTER_API_KEY || '';
  const songkickKey = process.env.SONGKICK_API_KEY || '';
  const geminiKey = process.env.GEMINI_API_KEY || '';

  // Ensure data dirs exist
  fs.mkdirSync(DATA_DIR, { recursive: true });

  let venueData = {};
  let eventData = [];

  // --- Google Places ---
  try {
    venueData = await fetchGooglePlaces(googleKey);
  } catch (err) {
    if (err.message === 'QUOTA_EXCEEDED') {
      console.log('[collect] Google quota exceeded – using cached data');
      venueData = loadExistingCities();
    } else {
      console.error(`[collect] Google Places failed: ${err.message}`);
      venueData = loadExistingCities();
    }
  }

  // --- Ticketmaster ---
  try {
    eventData = await fetchTicketmasterEvents(ticketmasterKey);
  } catch (err) {
    console.error(`[collect] Ticketmaster failed: ${err.message}`);
    eventData = [];
  }

  // --- Songkick ---
  try {
    const skEvents = await fetchSongkickEvents(songkickKey);
    eventData = [...eventData, ...skEvents];
  } catch (err) {
    console.error(`[collect] Songkick failed: ${err.message}`);
  }

  // Fallback to existing events if nothing fetched
  if (eventData.length === 0) {
    try { eventData = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf-8')); } catch { eventData = []; }
  }

  // --- Wikidata Website Enrichment ---
  try {
    const allVenues = Object.entries(venueData).flatMap(([city, venues]) =>
      venues.filter(v => !v.website).map(v => ({ ...v, city }))
    );
    if (allVenues.length > 0) {
      const websites = await findWebsites(allVenues);
      for (const vid of Object.keys(websites)) {
        for (const venues of Object.values(venueData)) {
          const v = venues.find(v => v.id === vid);
          if (v) { v.website = websites[vid]; break; }
        }
      }
    }
  } catch (err) { console.error(`[collect] Wikidata enrichment failed: ${err.message}`); }

  // --- Gemini AI Plans ---
  await generatePlans(geminiKey, eventData, PLANS_DIR);

  // --- Write per-city venue files ---
  let totalVenues = 0;
  for (const [city, venues] of Object.entries(venueData)) {
    if (venues.length === 0) continue;

    const safeName = city.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const filePath = path.join(DATA_DIR, `${safeName}.json`);
    const payload = {
      updated: new Date().toISOString(),
      city,
      count: venues.length,
      venues,
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
    totalVenues += venues.length;
  }

  // Write events file
  const eventsPayload = eventData.filter(e => {
    // Only keep future events (next 60 days)
    if (!e.date) return true;
    const d = new Date(e.date);
    const now = new Date();
    const limit = new Date();
    limit.setDate(limit.getDate() + 60);
    return d >= now && d <= limit;
  });

  fs.writeFileSync(EVENTS_FILE, JSON.stringify(eventsPayload, null, 2));

  // Write summary index
  const index = {};
  for (const city of Object.keys(venueData)) {
    const safeName = city.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const filePath = path.join(DATA_DIR, `${safeName}.json`);
    if (fs.existsSync(filePath)) {
      index[city] = `data/cities/${safeName}.json`;
    }
  }
  fs.writeFileSync(
    path.join(DATA_DIR, 'index.json'),
    JSON.stringify({ updated: new Date().toISOString(), cities: index }, null, 2)
  );

  console.log(`\n=== Done ===`);
  console.log(`  Cities with data: ${Object.keys(venueData).length}`);
  console.log(`  Total venues: ${totalVenues}`);
  console.log(`  Events: ${eventsPayload.length}`);
}

function loadExistingCities() {
  const indexFile = path.join(DATA_DIR, 'index.json');
  try {
    const index = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
    const data = {};
    for (const city of Object.keys(index.cities || {})) {
      const filePath = path.join(__dirname, '..', index.cities[city]);
      if (fs.existsSync(filePath)) {
        const cityData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        data[city] = cityData.venues || [];
      }
    }
    console.log(`[collect] Loaded ${Object.keys(data).length} cities from cache`);
    return data;
  } catch {
    console.log('[collect] No cache found');
    return {};
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

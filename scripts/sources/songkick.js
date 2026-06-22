// ===== Songkick API source =====
// Docs: https://www.songkick.com/developer
// Pricing: Free tier – no credit card required

async function fetchSongkickEvents(apiKey) {
  if (!apiKey || apiKey === 'YOUR_KEY_HERE') {
    console.log('[songkick] No API key – skipping');
    return [];
  }

  const allEvents = [];
  const metroAreas = [
    { id: 27877, name: 'Milano' },
    { id: 32882, name: 'Roma' },
    { id: 28181, name: 'Napoli' },
    { id: 27908, name: 'Torino' },
    { id: 27945, name: 'Bologna' },
    { id: 27850, name: 'Firenze' },
    { id: 30090, name: 'Palermo' },
    { id: 32900, name: 'Venezia' },
    { id: 27816, name: 'Genova' },
    { id: 27844, name: 'Bari' },
  ];

  for (const metro of metroAreas) {
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 3) {
      const url = new URL(`https://api.songkick.com/api/3.0/metro_areas/${metro.id}/calendar.json`);
      url.searchParams.set('apikey', apiKey);
      url.searchParams.set('page', String(page));
      url.searchParams.set('per_page', '50');

      try {
        const resp = await fetch(url.toString());
        if (!resp.ok) {
          console.error(`[songkick] Error ${resp.status} for ${metro.name}`);
          break;
        }
        const data = await resp.json();

        const entries = data?.resultsPage?.results?.calendarEntry;
        if (!entries || entries.length === 0) {
          hasMore = false;
          break;
        }

        for (const entry of entries) {
          const perf = entry.performance?.[0] || entry;
          const venue = entry.venue;

          allEvents.push({
            id: 'sk_' + entry.id,
            name: entry.displayName || perf.displayName,
            type: 'live_music',
            date: entry.start?.date || null,
            time: entry.start?.time || null,
            venue: venue?.displayName || '',
            city: venue?.metroArea?.displayName || metro.name,
            lat: venue?.lat || null,
            lng: venue?.lng || null,
            url: entry.uri || '',
            source: 'songkick',
          });
        }

        const totalPages = data?.resultsPage?.totalPages || 1;
        hasMore = page < totalPages;
        page++;
        await sleep(300);
      } catch (err) {
        console.error(`[songkick] Error for ${metro.name}: ${err.message}`);
        hasMore = false;
      }
    }
  }

  console.log(`[songkick] Fetched ${allEvents.length} events`);
  return allEvents;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = { fetchSongkickEvents };

// ===== Eventbrite API source =====
// Docs: https://www.eventbrite.com/platform/api
// Pricing: Free tier, no credit card, OAuth2 token required
// Get token: https://www.eventbrite.com/platform/api-keys

async function fetchEventbriteEvents(apiKey) {
  if (!apiKey || apiKey === 'YOUR_KEY_HERE') {
    console.log('[eventbrite] No API key – skipping');
    return [];
  }

  const allEvents = [];
  const cities = ['Rome', 'Milan', 'Naples', 'Turin', 'Bologna', 'Florence', 'Palermo', 'Bari', 'Genoa', 'Venice'];
  let page = 1;

  for (const city of cities) {
    try {
      const url = new URL('https://www.eventbriteapi.com/v3/events/search/');
      url.searchParams.set('token', apiKey);
      url.searchParams.set('location.address', city + ', Italy');
      url.searchParams.set('location.within', '30km');
      url.searchParams.set('expand', 'venue');
      url.searchParams.set('sort_by', 'date');
      url.searchParams.set('page', String(page));

      const resp = await fetch(url.toString());
      if (!resp.ok) {
        console.error(`[eventbrite] HTTP ${resp.status} for ${city}`);
        continue;
      }
      const data = await resp.json();

      for (const ev of data.events || []) {
        const venue = ev.venue;
        allEvents.push({
          id: 'eb_' + ev.id,
          name: ev.name?.text || ev.name || '',
          type: mapEventType(ev.category?.name || ''),
          date: ev.start?.local?.split('T')[0] || null,
          time: ev.start?.local?.split('T')[1]?.slice(0, 5) || null,
          venue: venue?.name || '',
          city: venue?.address?.city || '',
          lat: venue?.latitude ? parseFloat(venue.latitude) : null,
          lng: venue?.longitude ? parseFloat(venue.longitude) : null,
          url: ev.url || '',
          image: ev.logo?.url || '',
          description: (ev.summary || '').slice(0, 200),
          source: 'eventbrite',
        });
      }

      await sleep(500);
    } catch (err) {
      console.error(`[eventbrite] Error for ${city}: ${err.message}`);
    }
  }

  console.log(`[eventbrite] Fetched ${allEvents.length} events`);
  return allEvents;
}

function mapEventType(category) {
  const c = category.toLowerCase();
  if (c.includes('music') || c.includes('concert')) return 'live_music';
  if (c.includes('party') || c.includes('club') || c.includes('night')) return 'nightclub';
  if (c.includes('food') || c.includes('drink')) return 'restaurant';
  if (c.includes('film') || c.includes('movie')) return 'cinema';
  if (c.includes('art') || c.includes('theatre') || c.includes('comedy')) return 'theatre';
  return 'events_venue';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { fetchEventbriteEvents };

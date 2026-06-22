// ===== Ticketmaster Discovery API source =====
// Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
// Pricing: Free tier – 5000 requests/day

async function fetchTicketmasterEvents(apiKey) {
  if (!apiKey || apiKey === 'YOUR_KEY_HERE') {
    console.log('[ticketmaster] No API key – skipping');
    return [];
  }

  const allEvents = [];
  const countryCodes = ['IT'];
  const size = 200;

  for (const cc of countryCodes) {
    let page = 0;
    let hasMore = true;

    while (hasMore && allEvents.length < 2000) {
      const url = new URL('https://app.ticketmaster.com/discovery/v2/events.json');
      url.searchParams.set('apikey', apiKey);
      url.searchParams.set('countryCode', cc);
      url.searchParams.set('size', String(size));
      url.searchParams.set('page', String(page));
      url.searchParams.set('sort', 'date,asc');
      url.searchParams.set('locale', 'it-IT');

      try {
        const resp = await fetch(url.toString());
        if (resp.status === 429) {
          console.log('[ticketmaster] Rate limited – stopping');
          hasMore = false;
          break;
        }
        const data = await resp.json();

        if (!data._embedded?.events) {
          hasMore = false;
          break;
        }

        for (const ev of data._embedded.events) {
          const venue = ev._embedded?.venues?.[0];
          if (!venue?.location) continue;

          allEvents.push({
            id: ev.id,
            name: ev.name,
            type: mapClassification(ev.classifications),
            date: ev.dates?.start?.localDate || null,
            time: ev.dates?.start?.localTime || null,
            venue: venue.name || '',
            city: venue.city?.name || '',
            lat: parseFloat(venue.location.latitude),
            lng: parseFloat(venue.location.longitude),
            url: ev.url || '',
            image: ev.images?.find(i => i.width > 300)?.url || '',
            priceMin: ev.priceRanges?.[0]?.min || null,
            priceMax: ev.priceRanges?.[0]?.max || null,
            source: 'ticketmaster',
          });
        }

        page++;
        hasMore = page < (data.page?.totalPages || 0);
        await sleep(500);
      } catch (err) {
        console.error(`[ticketmaster] Error page ${page}: ${err.message}`);
        hasMore = false;
      }
    }
  }

  console.log(`[ticketmaster] Fetched ${allEvents.length} events`);
  return allEvents;
}

function mapClassification(classifications) {
  if (!classifications?.length) return 'other';
  const c = classifications[0];
  const segment = c.segment?.name?.toLowerCase() || '';
  const genre = c.genre?.name?.toLowerCase() || '';

  if (segment.includes('music') || genre.includes('edm') || genre.includes('electronic')) return 'live_music';
  if (genre.includes('rock') || genre.includes('pop')) return 'live_music';
  if (segment.includes('sports')) return 'sport';
  if (segment.includes('arts') || segment.includes('theatre')) return 'theatre';
  if (genre.includes('comedy')) return 'theatre';
  return 'events_venue';
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = { fetchTicketmasterEvents };

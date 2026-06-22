// ===== Google Places API source =====
// Docs: https://developers.google.com/maps/documentation/places/web-service
// Pricing: Text Search ~$0.017/request (up to 60 results), free $200/month credit

const ITALIAN_CITIES = [
  { name: 'Roma', lat: 41.9028, lng: 12.4964 },
  { name: 'Milano', lat: 45.4642, lng: 9.1900 },
  { name: 'Napoli', lat: 40.8518, lng: 14.2681 },
  { name: 'Torino', lat: 45.0703, lng: 7.6869 },
  { name: 'Palermo', lat: 38.1157, lng: 13.3615 },
  { name: 'Genova', lat: 44.4056, lng: 8.9463 },
  { name: 'Bologna', lat: 44.4949, lng: 11.3426 },
  { name: 'Firenze', lat: 43.7696, lng: 11.2558 },
  { name: 'Catania', lat: 37.5079, lng: 15.0918 },
  { name: 'Bari', lat: 41.1171, lng: 16.8719 },
  { name: 'Venezia', lat: 45.4408, lng: 12.3155 },
  { name: 'Verona', lat: 45.4384, lng: 10.9916 },
  { name: 'Messina', lat: 38.1938, lng: 15.5540 },
  { name: 'Padova', lat: 45.4064, lng: 11.8768 },
  { name: 'Trieste', lat: 45.6495, lng: 13.7768 },
  { name: 'Brescia', lat: 45.5416, lng: 10.2118 },
  { name: 'Parma', lat: 44.8015, lng: 10.3280 },
  { name: 'Taranto', lat: 40.4764, lng: 17.2296 },
  { name: 'Modena', lat: 44.6471, lng: 10.9252 },
  { name: 'Reggio Calabria', lat: 38.1106, lng: 15.6613 },
  { name: 'Perugia', lat: 43.1107, lng: 12.3908 },
  { name: 'Livorno', lat: 43.5485, lng: 10.3106 },
  { name: 'Ravenna', lat: 44.4184, lng: 12.2035 },
  { name: 'Cagliari', lat: 39.2238, lng: 9.1217 },
  { name: 'Foggia', lat: 41.4618, lng: 15.5444 },
  { name: 'Rimini', lat: 44.0594, lng: 12.5653 },
  { name: 'Salerno', lat: 40.6825, lng: 14.7681 },
  { name: 'Ferrara', lat: 44.8381, lng: 11.6199 },
  { name: 'Sassari', lat: 40.7267, lng: 8.5587 },
  { name: 'Siracusa', lat: 37.0755, lng: 15.2866 },
  { name: 'Pescara', lat: 42.4618, lng: 14.2161 },
  { name: 'Monza', lat: 45.5845, lng: 9.2745 },
  { name: 'Latina', lat: 41.4676, lng: 12.9037 },
  { name: 'Bergamo', lat: 45.6983, lng: 9.6773 },
  { name: 'Forlì', lat: 44.2227, lng: 12.0407 },
  { name: 'Trento', lat: 46.0748, lng: 11.1217 },
  { name: 'Vicenza', lat: 45.5455, lng: 11.5354 },
  { name: 'Terni', lat: 42.5636, lng: 12.6424 },
  { name: 'Bolzano', lat: 46.4983, lng: 11.3548 },
  { name: 'Novara', lat: 45.4469, lng: 8.6221 },
  { name: 'Piacenza', lat: 45.0522, lng: 9.6984 },
  { name: 'Ancona', lat: 43.6158, lng: 13.5189 },
  { name: 'Andria', lat: 41.2270, lng: 16.2952 },
  { name: 'Udine', lat: 46.0711, lng: 13.2346 },
  { name: 'Arezzo', lat: 43.4631, lng: 11.8784 },
  { name: 'Cesena', lat: 44.1396, lng: 12.2431 },
  { name: 'Lecce', lat: 40.3516, lng: 18.1718 },
  { name: 'Pesaro', lat: 43.9088, lng: 12.9137 },
  { name: 'Alessandria', lat: 44.9091, lng: 8.6117 },
  { name: 'La Spezia', lat: 44.1023, lng: 9.8243 },
];

const SEARCH_QUERIES = [
  { query: 'discoteche', type: 'nightclub' },
  { query: 'pub birreria', type: 'pub' },
  { query: 'bar cocktail', type: 'bar' },
  { query: 'cinema multisala', type: 'cinema' },
  { query: 'teatro spettacoli', type: 'theatre' },
  { query: 'musica dal vivo concerti', type: 'live_music' },
  { query: 'sale da ballo', type: 'dance_hall' },
  { query: 'sale eventi feste', type: 'events_venue' },
];

const VENUE_ICONS = {
  nightclub: '🪩', pub: '🍻', bar: '🍺', cinema: '🎬', theatre: '🎭',
  live_music: '🎵', dance_hall: '💃', events_venue: '🎪', restaurant: '🍽️',
  bowling: '🎳', casino: '🎰', arcade: '🕹️', karaoke: '🎤',
};

const VENUE_LABELS = {
  nightclub: 'Discoteca', pub: 'Pub', bar: 'Bar', cinema: 'Cinema',
  theatre: 'Teatro', live_music: 'Musica dal vivo', dance_hall: 'Ballo',
  events_venue: 'Sale eventi', restaurant: 'Ristorante', bowling: 'Bowling',
  casino: 'Casinò', arcade: 'Sala giochi', karaoke: 'Karaoke',
};

async function fetchGooglePlaces(apiKey) {
  if (!apiKey || apiKey === 'YOUR_KEY_HERE') {
    console.log('[google] No API key – skipping');
    return {};
  }

  const results = {};
  let totalRequests = 0;

  const BATCH_SIZE = 5;
  for (let ci = 0; ci < ITALIAN_CITIES.length; ci += BATCH_SIZE) {
    const batch = ITALIAN_CITIES.slice(ci, ci + BATCH_SIZE);

    for (const city of batch) {
      for (const sq of SEARCH_QUERIES) {
        if (totalRequests >= 5000) {
          console.log('[google] Reached safe limit (5000) – stopping');
          return dedupe(results);
        }

        const venues = await searchCity(apiKey, city, sq);
        if (venues.length > 0) {
          if (!results[city.name]) results[city.name] = [];
          results[city.name].push(...venues);
        }
        totalRequests++;
        await sleep(300);
      }
    }

    console.log(`[google] ${Math.min(ci + BATCH_SIZE, ITALIAN_CITIES.length)}/${ITALIAN_CITIES.length} cities (${totalRequests} reqs)`);
    await sleep(2000);
  }

  console.log(`[google] Done: ${totalRequests} requests, ${Object.values(results).flat().length} venues`);
  return dedupe(results);
}

async function searchCity(apiKey, city, sq) {
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query', `${sq.query} ${city.name}`);
  url.searchParams.set('location', `${city.lat},${city.lng}`);
  url.searchParams.set('radius', '30000');
  url.searchParams.set('language', 'it');
  url.searchParams.set('key', apiKey);

  try {
    const resp = await fetch(url.toString());
    const data = await resp.json();

    if (data.status === 'OVER_QUERY_LIMIT') throw new Error('QUOTA_EXCEEDED');

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error(`  [google] ${city.name}/${sq.type}: ${data.status}`);
      return [];
    }

    return (data.results || []).map(place => ({
      id: 'gp_' + place.place_id,
      name: place.name,
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
      address: place.formatted_address || place.vicinity || '',
      type: sq.type,
      rating: place.rating || null,
      totalRatings: place.user_ratings_total || 0,
      icon: VENUE_ICONS[sq.type] || '📍',
      label: VENUE_LABELS[sq.type] || sq.type,
      source: 'google',
    }));
  } catch (err) {
    if (err.message === 'QUOTA_EXCEEDED') throw err;
    console.error(`  [google] Fetch error [${city.name}]: ${err.message}`);
    return [];
  }
}

function dedupe(results) {
  const cleaned = {};
  for (const [city, venues] of Object.entries(results)) {
    const seen = new Set();
    cleaned[city] = venues.filter(v => {
      const key = `${v.name}|${v.lat.toFixed(5)}|${v.lng.toFixed(5)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return cleaned;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = { fetchGooglePlaces, ITALIAN_CITIES };

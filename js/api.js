// ===== Overpass API – fetch venues from OpenStreetMap =====
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const VENUE_TYPES = {
  nightclub:     { tags: ['["amenity"="nightclub"]'],                                   icon: '🪩', label: 'Discoteca' },
  bar:           { tags: ['["amenity"="bar"]', '["amenity"="cafe"]', '["amenity"="biergarten"]'], icon: '🍺', label: 'Bar' },
  pub:           { tags: ['["amenity"="pub"]'],                                          icon: '🍻', label: 'Pub' },
  cinema:        { tags: ['["amenity"="cinema"]'],                                       icon: '🎬', label: 'Cinema' },
  theatre:       { tags: ['["amenity"="theatre"]'],                                      icon: '🎭', label: 'Teatro' },
  restaurant:    { tags: ['["amenity"="restaurant"]'],                                   icon: '🍽️', label: 'Ristorante' },
  live_music:    { tags: ['["amenity"="music_venue"]', '["live_music"="yes"]'], icon: '🎵', label: 'Musica dal vivo' },
  bowling:       { tags: ['["amenity"="bowling"]', '"leisure"="bowling_alley"'],         icon: '🎳', label: 'Bowling' },
  events_venue:  { tags: ['["amenity"="community_centre"]'],                             icon: '🎪', label: 'Sale eventi' },
  dance_hall:    { tags: ['["leisure"="dance"', '"amenity"="dancing_school"'],           icon: '💃', label: 'Ballo' },
  casino:        { tags: ['["amenity"="casino"'],                                        icon: '🎰', label: 'Casinò' },
  arcade:        { tags: ['["leisure"="amusement_arcade"'],                               icon: '🕹️', label: 'Sala giochi' },
  karaoke:       { tags: ['["amenity"="karaoke_box"', '"amenity"="karaoke"'],           icon: '🎤', label: 'Karaoke' },
};

function buildOverpassQuery(center, radiusMeters, types) {
  const blocks = [];
  const lat = center.lat.toFixed(5);
  const lng = center.lng.toFixed(5);

  types.forEach(t => {
    const def = VENUE_TYPES[t];
    if (!def) return;
    def.tags.forEach(tag => {
      const selector = `[${tag.replace(/[\[\]]/g, '')}]`;
      blocks.push(`nwr${selector}(around:${radiusMeters},${lat},${lng});`);
    });
  });

  return `[out:json][timeout:20];(\n${blocks.join('\n')}\n);out center;`;
}

async function fetchVenues(center, radiusKm, selectedTypes, signal) {
  const radiusMeters = Math.min(radiusKm * 1000, 50000);

  const BATCH = 6;
  if (selectedTypes.length > BATCH) {
    const batches = [];
    for (let i = 0; i < selectedTypes.length; i += BATCH) {
      batches.push(selectedTypes.slice(i, i + BATCH));
    }

    const results = await Promise.allSettled(
      batches.map(b => fetchVenuesBatch(center, radiusMeters, b, signal))
    );

    const allResults = [];
    if (results.every(r => r.status === 'rejected')) throw results[0].reason;
    window._venueSearchPartial = results.some(r => r.status === 'rejected');
    for (const r of results) {
      if (r.status === 'fulfilled') allResults.push(...r.value);
    }

    const seen = new Set();
    const venues = allResults.filter(v => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });
    venues.partial = window._venueSearchPartial;
    return venues;
  }

  return fetchVenuesBatch(center, radiusMeters, selectedTypes, signal);
}

async function fetchVenuesBatch(center, radiusMeters, types, signal) {
  const query = buildOverpassQuery(center, radiusMeters, types);

  let lastError;

  for (const url of OVERPASS_URLS) {
    if (signal?.aborted) throw new DOMException('Ricerca annullata', 'AbortError');
    let timeout;
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      timeout = setTimeout(() => controller.abort(), 25000);
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: query,
        signal: controller.signal,
      });

      if (!resp.ok) {
        lastError = new Error(`Overpass API error ${resp.status}`);
        continue;
      }

      const data = await resp.json();
      if (data.remark) throw new Error('Risposta Overpass incompleta: riprova con un raggio minore');

      if (!data.elements || data.elements.length === 0) return [];

      const seen = new Set();

      return data.elements
        .filter(el => {
          const key = `${el.type}/${el.id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map(el => {
          const tags = el.tags || {};
          const cat = findCategory(tags, types);
          const venue = {
            id: `${el.type}/${el.id}`,
            lat: el.lat ?? el.center?.lat,
            lng: el.lon ?? el.center?.lon,
            name: String(tags.name || tags['name:it'] || VENUE_TYPES[cat]?.label || 'Locale'),
            address: formatAddress(tags),
            type: cat,
            icon: VENUE_TYPES[cat]?.icon || '📍',
            label: VENUE_TYPES[cat]?.label || '',
            website: tags.website || tags['contact:website'] || tags['contact:facebook'] || null,
            phone: tags.phone || tags['contact:phone'] || null,
            openingHours: tags.opening_hours || null,
            tags: tags,
            source: 'osm',
          };
          return venue;
        })
        .filter(v => v.lat != null && v.lng != null);

    } catch (err) {
      if (err.name === 'AbortError') {
        lastError = new Error('Overpass API timeout (25s)');
      } else {
        lastError = err;
      }
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
  }

  throw lastError || new Error('Tutti i server Overpass non disponibili');
}

function findCategory(tags, selectedTypes) {
  for (const t of selectedTypes) {
    const def = VENUE_TYPES[t];
    if (!def) continue;
    for (const tagStr of def.tags) {
      const match = tagStr.match(/"(\w+)"="([^"]+)"/);
      if (match && tags[match[1]] === match[2]) return t;
    }
  }
  return selectedTypes[0];
}

function formatAddress(tags) {
  const parts = [];
  if (tags['addr:street']) {
    const num = tags['addr:housenumber'] || '';
    parts.push(num ? `${tags['addr:street']} ${num}` : tags['addr:street']);
  }
  const city = tags['addr:city'] || tags['addr:town'] || tags['addr:village'];
  if (city) parts.push(city);
  return parts.join(', ') || 'Indirizzo non disponibile';
}

function sanitize(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

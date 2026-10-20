// ===== Overpass API – fetch venues from OpenStreetMap =====
const OVERPASS_URLS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];
const OVERPASS_COOLDOWN = new Map();

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
  const selectors = new Map();
  const lat = center.lat.toFixed(5);
  const lng = center.lng.toFixed(5);

  types.forEach(t => {
    const def = VENUE_TYPES[t];
    if (!def) return;
    def.tags.forEach(tag => {
      const match = tag.match(/"([^"]+)"="([^"]+)"/);
      if (!match) return;
      if (!selectors.has(match[1])) selectors.set(match[1], new Set());
      selectors.get(match[1]).add(match[2]);
    });
  });

  selectors.forEach((values, key) => {
    const list = [...values];
    const selector = list.length === 1 ? `["${key}"="${list[0]}"]` : `["${key}"~"^(${list.join('|')})$"]`;
    blocks.push(`nwr${selector}(around:${radiusMeters},${lat},${lng});`);
  });
  return `[out:json][timeout:8];(\n${blocks.join('\n')}\n);out center qt;`;
}

async function fetchVenues(center, radiusKm, selectedTypes, signal) {
  const radiusMeters = Math.min(radiusKm * 1000, 50000);

  return fetchVenuesBatch(center, radiusMeters, selectedTypes, signal);
}

async function fetchVenuesBatch(center, radiusMeters, types, signal) {
  const query = buildOverpassQuery(center, radiusMeters, types);

  let lastError;

  for (const url of OVERPASS_URLS) {
    if (signal?.aborted) throw new DOMException('Ricerca annullata', 'AbortError');
    if ((OVERPASS_COOLDOWN.get(url) || 0) > Date.now()) continue;
    let timeout;
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      timeout = setTimeout(() => controller.abort(), 9000);
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: controller.signal,
      });

      if (!resp.ok) {
        if ([406, 429, 502, 503, 504].includes(resp.status)) OVERPASS_COOLDOWN.set(url, Date.now() + 30000);
        lastError = new Error(`Overpass API error ${resp.status}`);
        continue;
      }

      const data = await resp.json();
      if (!Array.isArray(data.elements)) throw new Error('Risposta non valida dal servizio dei locali');
      if (data.remark && !data.elements?.length) throw new Error('Il server non ha completato la ricerca. Prova un raggio minore.');

      if (!data.elements || data.elements.length === 0) return [];

      const seen = new Set();

      const venues = data.elements
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
      venues.partial = !!data.remark;
      return venues;

    } catch (err) {
      if (err.name === 'AbortError') {
        if (signal?.aborted) throw new DOMException('Ricerca annullata', 'AbortError');
        lastError = new Error('Il servizio dei locali non risponde entro 9 secondi');
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

// ===== Overpass API – fetch venues from OpenStreetMap =====
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const VENUE_TYPES = {
  nightclub:   { overpass: '["amenity"="nightclub"]', icon: '🪩', label: 'Discoteca' },
  bar:         { overpass: '["amenity"="bar"]["smoking"!="yes"]', icon: '🍺', label: 'Bar' },
  pub:         { overpass: '["amenity"="pub"]', icon: '🍻', label: 'Pub' },
  cinema:      { overpass: '["amenity"="cinema"]', icon: '🎬', label: 'Cinema' },
  theatre:     { overpass: '["amenity"="theatre"]', icon: '🎭', label: 'Teatro' },
  restaurant:  { overpass: '["amenity"="restaurant"]', icon: '🍽️', label: 'Ristorante' },
  live_music:  { overpass: '["amenity"="music_venue"]', icon: '🎵', label: 'Musica dal vivo' },
  bowling:     { overpass: '["amenity"="bowling"]', icon: '🎳', label: 'Bowling' },
};

function buildOverpassQuery(center, radiusMeters, types) {
  const tags = types.map(t => `node${VENUE_TYPES[t].overpass}(around:${radiusMeters},${center.lat},${center.lng});`).join('\n');
  return `[out:json][timeout:15];(\n${tags}\n);out center 100;`;
}

async function fetchVenues(center, radiusKm, selectedTypes) {
  const radiusMeters = radiusKm * 1000;
  const query = buildOverpassQuery(center, radiusMeters, selectedTypes);

  const resp = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: query,
  });

  if (!resp.ok) throw new Error(`Overpass API error: ${resp.status}`);

  const data = await resp.json();

  return data.elements.map(el => {
    const tags = el.tags || {};
    const cat = findCategory(tags, selectedTypes);
    return {
      id: el.id,
      lat: el.lat,
      lng: el.lon,
      name: tags.name || tags['name:it'] || VENUE_TYPES[cat]?.label || 'Locale',
      address: formatAddress(tags),
      type: cat,
      icon: VENUE_TYPES[cat]?.icon || '📍',
      label: VENUE_TYPES[cat]?.label || '',
      website: tags.website || tags['contact:website'] || null,
      phone: tags.phone || tags['contact:phone'] || null,
      openingHours: tags.opening_hours || null,
    };
  });
}

function findCategory(tags, selectedTypes) {
  for (const t of selectedTypes) {
    const p = VENUE_TYPES[t].overpass;
    const keyMatch = p.match(/"([^"]+)"/g);
    if (!keyMatch || keyMatch.length < 2) continue;
    const k = keyMatch[0].replace(/"/g, '');
    const v = keyMatch[1].replace(/"/g, '');
    if (tags[k] === v) return t;
  }
  return selectedTypes[0];
}

function formatAddress(tags) {
  const parts = [];
  if (tags['addr:street']) parts.push(tags['addr:street']);
  if (tags['addr:housenumber']) parts[parts.length - 1] += ' ' + tags['addr:housenumber'];
  if (tags['addr:city']) parts.push(tags['addr:city']);
  return parts.join(', ') || 'Indirizzo non disponibile';
}

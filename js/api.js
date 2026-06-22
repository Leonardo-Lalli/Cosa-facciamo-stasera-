// ===== Overpass API – fetch venues from OpenStreetMap =====
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const VENUE_TYPES = {
  nightclub:     { tags: ['["amenity"="nightclub"]'],                                   icon: '🪩', label: 'Discoteca' },
  bar:           { tags: ['["amenity"="bar"]'],                                          icon: '🍺', label: 'Bar' },
  pub:           { tags: ['["amenity"="pub"]'],                                          icon: '🍻', label: 'Pub' },
  cinema:        { tags: ['["amenity"="cinema"]'],                                       icon: '🎬', label: 'Cinema' },
  theatre:       { tags: ['["amenity"="theatre"]'],                                      icon: '🎭', label: 'Teatro' },
  restaurant:    { tags: ['["amenity"="restaurant"]'],                                   icon: '🍽️', label: 'Ristorante' },
  live_music:    { tags: ['["amenity"="music_venue"]'],                                  icon: '🎵', label: 'Musica dal vivo' },
  bowling:       { tags: ['["amenity"="bowling"', '"leisure"="bowling_alley"'],          icon: '🎳', label: 'Bowling' },
  events_venue:  { tags: ['["amenity"="community_centre"]'],                             icon: '🎪', label: 'Sale eventi' },
  dance_hall:    { tags: ['["leisure"="dance"', '"amenity"="dancing_school"'],           icon: '💃', label: 'Ballo' },
  casino:        { tags: ['["amenity"="casino"'],                                        icon: '🎰', label: 'Casinò' },
  arcade:        { tags: ['["leisure"="amusement_arcade"'],                               icon: '🕹️', label: 'Sala giochi' },
  karaoke:       { tags: ['["amenity"="karaoke_box"', '"amenity"="karaoke"'],           icon: '🎤', label: 'Karaoke' },
};

function buildOverpassQuery(center, radiusMeters, types) {
  const blocks = [];

  types.forEach(t => {
    const def = VENUE_TYPES[t];
    if (!def) return;
    def.tags.forEach(tag => {
      blocks.push(`node${tag}(around:${radiusMeters},${center.lat},${center.lng});`);
      blocks.push(`way${tag}(around:${radiusMeters},${center.lat},${center.lng});`);
    });
  });

  return `[out:json][timeout:20];(\n${blocks.join('\n')}\n);out center 100;`;
}

async function fetchVenues(center, radiusKm, selectedTypes) {
  const radiusMeters = Math.min(radiusKm * 1000, 50000);
  const query = buildOverpassQuery(center, radiusMeters, selectedTypes);

  let lastError;

  for (const url of OVERPASS_URLS) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: query,
      });

      if (!resp.ok) {
        lastError = new Error(`Overpass API error ${resp.status}`);
        continue;
      }

      const data = await resp.json();

      if (!data.elements || data.elements.length === 0) return [];

      const seen = new Set();

      return data.elements
        .filter(el => {
          if (seen.has(el.id)) return false;
          seen.add(el.id);
          return true;
        })
        .map(el => {
          const tags = el.tags || {};
          const cat = findCategory(tags, selectedTypes);
          const venue = {
            id: el.id,
            lat: el.lat ?? el.center?.lat,
            lng: el.lon ?? el.center?.lon,
            name: tags.name || tags['name:it'] || VENUE_TYPES[cat]?.label || 'Locale',
            address: formatAddress(tags),
            type: cat,
            icon: VENUE_TYPES[cat]?.icon || '📍',
            label: VENUE_TYPES[cat]?.label || '',
            website: tags.website || tags['contact:website'] || tags['contact:facebook'] || null,
            phone: tags.phone || tags['contact:phone'] || null,
            openingHours: tags.opening_hours || null,
            tags: tags,
          };
          venue.description = describeVenue(venue, tags);
          return venue;
        })
        .filter(v => v.lat != null && v.lng != null);

    } catch (err) {
      lastError = err;
    }
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
    parts.push(tags['addr:housenumber'] ? `${tags['addr:street']} ${tags['addr:housenumber']}` : tags['addr:street']);
  }
  const city = tags['addr:city'] || tags['addr:town'] || tags['addr:village'];
  if (city) parts.push(city);
  return parts.join(', ') || 'Indirizzo non disponibile';
}

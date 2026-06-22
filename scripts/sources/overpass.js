// ===== Overpass source for collector =====
// Fetches venues from OpenStreetMap (same logic as frontend)
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const VENUE_TAGS = [
  { tag: '["amenity"="nightclub"]', type: 'nightclub' },
  { tag: '["amenity"="bar"]', type: 'bar' },
  { tag: '["amenity"="pub"]', type: 'pub' },
  { tag: '["amenity"="cinema"]', type: 'cinema' },
  { tag: '["amenity"="theatre"]', type: 'theatre' },
  { tag: '["amenity"="restaurant"]', type: 'restaurant' },
  { tag: '["amenity"="music_venue"]', type: 'live_music' },
  { tag: '["amenity"="community_centre"]', type: 'events_venue' },
];

async function fetchVenuesForCity(city, radiusKm = 15) {
  const radiusM = radiusKm * 1000;
  const blocks = VENUE_TAGS.map(vt =>
    `node${vt.tag}(around:${radiusM},${city.lat},${city.lng});`
  ).join('\n');

  const query = `[out:json][timeout:15];(\n${blocks}\n);out center 50;`;

  try {
    const resp = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: query,
    });
    if (!resp.ok) return [];
    const data = await resp.json();

    return (data.elements || [])
      .filter(el => el.tags?.name)
      .map(el => ({
        name: el.tags.name,
        type: VENUE_TAGS.find(vt => {
          const [k, v] = vt.tag.replace(/[[\]"]/g, '').split('=');
          return el.tags[k] === v;
        })?.type || 'other',
        lat: el.lat, lng: el.lon,
      }))
      .slice(0, 30);
  } catch {
    return [];
  }
}

module.exports = { fetchVenuesForCity };

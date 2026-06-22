// ===== OSRM + OpenRouteService Routing =====
const OSRM_URL = 'https://router.project-osrm.org';
const ORS_URL = 'https://api.openrouteservice.org/v2/directions';
const ORS_KEY = ''; // Get free key: https://openrouteservice.org/dev/#/signup (2000 req/day)

const MODE_PROFILE = {
  walking: 'foot',
  cycling: 'bike',
  driving: 'driving',
};

async function getTransitRoutes(origin, destinations) {
  if (destinations.length === 0) return [];
  
  try {
    const results = [];
    for (const dest of destinations) {
      const body = {
        coordinates: [[origin.lng, origin.lat], [dest.lng, dest.lat]],
        preference: 'recommended',
        language: 'it',
      };
      const resp = await fetch(`${ORS_URL}/public-transport/geojson`, {
        method: 'POST',
        headers: {
          'Authorization': ORS_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) { results.push(null); continue; }
      const data = await resp.json();
      const features = data.features || [];
      if (!features.length) { results.push(null); continue; }
      const summary = features[0].properties?.summary || {};
      results.push({
        duration: Math.round((summary.duration || 0) / 60),
        distance: ((summary.distance || 0) / 1000).toFixed(1),
        routes: features.slice(0, 2).map(f => ({
          duration: Math.round((f.properties?.summary?.duration || 0) / 60),
          segments: (f.properties?.segments || []).map(s => ({
            type: s.type,
            line: s.line || s.name || '',
            from: s.from?.name || '',
            to: s.to?.name || '',
            stops: s.stops || 0,
            duration: Math.round((s.duration || 0) / 60),
          })),
        })),
      });
      await new Promise(r => setTimeout(r, 200));
    }
    return results;
  } catch {
    return destinations.map(d => estimate(origin, d, 'transit'));
  }
}

const MODE_PROFILE = {
  walking: 'foot',
  cycling: 'bike',
  driving: 'driving',
};

async function getRoutesBatch(origin, destinations, mode) {
  const profile = MODE_PROFILE[mode] || 'foot';
  if (destinations.length === 0) return [];

  const coords = [origin, ...destinations].map(p => `${p.lng},${p.lat}`).join(';');
  const url = `${OSRM_URL}/table/v1/${profile}/${coords}?annotations=duration,distance`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`OSRM ${resp.status}`);
    const data = await resp.json();

    if (!data.durations || data.durations.length < 2) throw new Error('No routes');

    const results = [];
    for (let i = 0; i < destinations.length; i++) {
      const durationSec = data.durations[0]?.[i + 1];
      const distanceM = data.distances[0]?.[i + 1];
      if (durationSec != null) {
        results.push({
          duration: Math.round(durationSec / 60),
          distance: (distanceM / 1000).toFixed(1),
        });
      } else {
        results.push(null);
      }
    }
    return results;
  } catch {
    // Fallback: haversine estimation
    return destinations.map(d => estimate(origin, d, mode));
  }
}

function estimate(origin, dest, mode) {
  const dist = haversineKm(origin, dest);
  const speeds = { walking: 5, cycling: 15, transit: 25, driving: 40 };
  const speed = speeds[mode] || 5;
  return {
    duration: Math.round((dist / speed) * 60),
    distance: dist.toFixed(1),
  };
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  if (dLat === 0 && dLng === 0) return 0;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const v = sinLat * sinLat + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(Math.min(v, 1)), Math.sqrt(1 - Math.min(v, 1)));
}

async function getRoutesForModes(origin, destinations) {
  const modes = ['walking', 'cycling', 'transit', 'driving'];
  const routes = {};

  const batches = modes.map(mode => {
    if (mode === 'transit' && ORS_KEY) {
      return getTransitRoutes(origin, destinations)
        .then(results => { routes[mode] = results; });
    }
    return getRoutesBatch(origin, destinations, mode)
      .then(results => { routes[mode] = results; });
  });
  await Promise.allSettled(batches);
  // Fill missing with estimates
  modes.forEach(mode => {
    if (!routes[mode]) routes[mode] = destinations.map(d => estimate(origin, d, mode));
  });

  const mapped = {};
  destinations.forEach((_, i) => {
    mapped[i] = {};
    modes.forEach(mode => {
      if (routes[mode]?.[i]) mapped[i][mode] = routes[mode][i];
    });
  });

  return mapped;
}

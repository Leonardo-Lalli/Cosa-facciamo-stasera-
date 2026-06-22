// ===== OSRM Routing – travel time & distance =====
const OSRM_URL = 'https://router.project-osrm.org';

async function getRoute(origin, dest, mode) {
  const profiles = {
    walking: 'foot',
    cycling: 'bike',
  };

  if (mode === 'driving') {
    return getDrivingRoute(origin, dest);
  }

  const profile = profiles[mode] || 'foot';
  const url = `${OSRM_URL}/route/v1/${profile}/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false`;

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`OSRM error: ${resp.status}`);
  const data = await resp.json();

  if (!data.routes || data.routes.length === 0) return null;

  const route = data.routes[0];
  return {
    duration: Math.round(route.duration / 60),
    distance: (route.distance / 1000).toFixed(1),
  };
}

async function getDrivingRoute(origin, dest) {
  const url = `${OSRM_URL}/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false`;

  const resp = await fetch(url);
  if (!resp.ok) return estimateDriving(origin, dest);
  const data = await resp.json();

  if (!data.routes || data.routes.length === 0) return estimateDriving(origin, dest);

  const route = data.routes[0];
  return {
    duration: Math.round(route.duration / 60),
    distance: (route.distance / 1000).toFixed(1),
  };
}

function estimateDriving(origin, dest) {
  const dist = haversine(origin, dest);
  const speed = 40; // km/h average city speed
  return {
    duration: Math.round((dist / speed) * 60),
    distance: dist.toFixed(1),
  };
}

function haversine(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const aVal = sinLat * sinLat + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
}

async function getRoutesForModes(origin, dest) {
  const modes = ['walking', 'cycling', 'driving'];
  const results = {};

  for (const mode of modes) {
    try {
      results[mode] = await getRoute(origin, dest, mode);
    } catch {
      results[mode] = null;
    }
  }

  return results;
}

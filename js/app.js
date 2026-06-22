// ===== Main App Controller =====

async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  const resp = await fetch(url, { headers: { 'Accept-Language': 'it' } });
  const data = await resp.json();
  if (data.length === 0) throw new Error('Luogo non trovato');
  const addr = data[0];
  const city = addr.address?.city || addr.address?.town || addr.address?.village || query;
  return { lat: parseFloat(addr.lat), lng: parseFloat(addr.lon), display: addr.display_name, city };
}

async function loadEnrichedVenues(cityName) {
  const safeName = cityName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  try {
    const resp = await fetch(`data/cities/${safeName}.json`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.venues || [];
  } catch { return []; }
}

async function loadEvents(cityName) {
  try {
    const resp = await fetch('data/events.json');
    if (!resp.ok) return [];
    const events = await resp.json();
    const cn = cityName.toLowerCase();
    return events.filter(e =>
      (e.city || '').toLowerCase().includes(cn) || cn.includes((e.city || '').toLowerCase())
    );
  } catch { return []; }
}

function mergeVenues(osmVenues, enriched) {
  const seen = new Set();
  osmVenues.forEach(v => seen.add(`${v.name}|${v.lat?.toFixed(4)}|${v.lng?.toFixed(4)}`));
  const extra = enriched.filter(v => {
    const key = `${v.name}|${v.lat?.toFixed(4)}|${v.lng?.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const unified = extra.map(v => ({
    id: v.id, lat: v.lat, lng: v.lng, name: v.name,
    address: v.address || '', type: v.type,
    icon: getEnrichedIcon(v.type), label: getEnrichedLabel(v.type),
    website: v.website || null, phone: null, openingHours: null,
    rating: v.rating || null, source: 'google',
  }));
  return [...osmVenues, ...unified];
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocalizzazione non supportata'));
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error('Impossibile ottenere la posizione'))
    );
  });
}

let sortListenerAttached = false;

function getEnrichedIcon(type) {
  const m = { nightclub:'🪩', pub:'🍻', bar:'🍺', cinema:'🎬', theatre:'🎭', live_music:'🎵', dance_hall:'💃', events_venue:'🎪', restaurant:'🍽️', bowling:'🎳', casino:'🎰', arcade:'🕹️', karaoke:'🎤' };
  return m[type] || '📍';
}

function getEnrichedLabel(type) {
  const m = { nightclub:'Discoteca', pub:'Pub', bar:'Bar', cinema:'Cinema', theatre:'Teatro', live_music:'Musica dal vivo', dance_hall:'Ballo', events_venue:'Sale eventi', restaurant:'Ristorante', bowling:'Bowling', casino:'Casinò', arcade:'Sala giochi', karaoke:'Karaoke' };
  return m[type] || type;
}

let debounceTimer;

async function performSearch() {
  const filters = getFilters();
  if (filters.types.length === 0) { alert('Seleziona almeno un tipo di locale'); return; }

  const locationInput = document.getElementById('location-input').value.trim();
  if (!locationInput && !userLocation) {
    alert('Inserisci una città o clicca 📍 per usare la tua posizione');
    return;
  }

  showLoading();
  clearVenueMarkers();
  hideVenueDetail();

  try {
    if (locationInput && (!userLocation || userLocation.display !== locationInput)) {
      const loc = await geocode(locationInput);
      userLocation = loc;
      setUserLocation(loc.lat, loc.lng);
      drawRadiusCircle(loc, filters.radius);
    } else if (userLocation) {
      drawRadiusCircle(userLocation, filters.radius);
    }

    const osmVenues = await fetchVenues(userLocation, filters.radius, filters.types);

    const [enriched, events] = await Promise.all([
      loadEnrichedVenues(userLocation.city).catch(() => []),
      loadEvents(userLocation.city).catch(() => []),
    ]);

    const venues = mergeVenues(osmVenues, enriched);
    window._events = events.length > 0 ? events : window._events || [];

    if (venues.length === 0) {
      hideLoading();
      renderVenueList([], {}, () => {}, []);
      clearVenueMarkers();
      return;
    }

    // Show immediately with estimated distances
    const estRoutes = {};
    venues.forEach(v => {
      estRoutes[v.id] = { walking: estimate({ lat: userLocation.lat, lng: userLocation.lng }, { lat: v.lat, lng: v.lng }, 'walking') };
    });

    saveScrollPosition();
    sortAndRender(venues, estRoutes);
    restoreScrollPosition();

    addVenueMarkers(venues, venue => {
      const routes = window._venueRoutes || estRoutes;
      showVenueDetail(venue, routes);
      highlightVenueCard(venue);
      highlightMarker(venue.id);
    });
    fitBounds(venues);

    // Batch OSRM routes
    const dests = venues.map(v => ({ lat: v.lat, lng: v.lng }));
    const batchRoutes = await getRoutesForModes(
      { lat: userLocation.lat, lng: userLocation.lng }, dests
    );

    const realRoutes = {};
    venues.forEach((v, i) => { realRoutes[v.id] = batchRoutes[i] || {}; });
    window._venueRoutes = realRoutes;

    // Filter by max time
    const filtered = venues.filter(v => {
      const r = realRoutes[v.id];
      if (!r || Object.keys(r).length === 0) return true;
      const times = Object.values(r).filter(Boolean).map(x => x.duration);
      if (times.length === 0) return true;
      return Math.min(...times) <= filters.maxTime;
    });

    saveScrollPosition();
    sortAndRender(filtered, realRoutes);
    restoreScrollPosition();

  } catch (err) {
    hideLoading();
    console.error(err);
    alert('Errore: ' + (err.message || 'Qualcosa è andato storto'));
  }
}

function saveScrollPosition() {
  const list = document.getElementById('venue-list');
  if (list) list.dataset.scrollTop = list.scrollTop;
}

function restoreScrollPosition() {
  const list = document.getElementById('venue-list');
  if (list && list.dataset.scrollTop) {
    requestAnimationFrame(() => { list.scrollTop = parseInt(list.dataset.scrollTop); });
  }
}

function sortAndRender(venues, routes) {
  const sortBy = document.getElementById('sort-select').value;
  const sorted = [...venues];

  if (sortBy === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'it'));
  else if (sortBy === 'time') sorted.sort((a, b) => getBestTime(routes[a.id]) - getBestTime(routes[b.id]));
  else sorted.sort((a, b) => getBestDist(routes[a.id]) - getBestDist(routes[b.id]));

  renderVenueList(sorted, routes, venue => {
    showVenueDetail(venue, routes);
    highlightVenueCard(venue);
    highlightMarker(venue.id);
  }, window._events || []);

  if (!sortListenerAttached) {
    sortListenerAttached = true;
    document.getElementById('sort-select').addEventListener('change', () => {
      saveScrollPosition();
      sortAndRender(window._lastVenues || sorted, window._venueRoutes || routes);
      restoreScrollPosition();
    });
  }
  window._lastVenues = sorted;
}

function getBestTime(r) { if (!r || Object.keys(r).length === 0) return Infinity; return Math.min(...Object.values(r).filter(Boolean).map(x => x.duration)); }
function getBestDist(r) { if (!r || Object.keys(r).length === 0) return Infinity; return Math.min(...Object.values(r).filter(Boolean).map(x => parseFloat(x.distance))); }

function highlightVenueCard(venue) {
  document.querySelectorAll('.venue-card.active').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.venue-card').forEach(card => {
    if (card.querySelector('.venue-name')?.textContent === venue.name) {
      card.classList.add('active');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}

// Event listeners
document.getElementById('search-btn').addEventListener('click', performSearch);

document.getElementById('locate-btn').addEventListener('click', async () => {
  try {
    const pos = await getCurrentPosition();
    userLocation = pos;
    setUserLocation(pos.lat, pos.lng);
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.lat}&lon=${pos.lng}`;
      const resp = await fetch(url, { headers: { 'Accept-Language': 'it' } });
      const data = await resp.json();
      const city = data.address?.city || data.address?.town || data.address?.village || '';
      if (city) document.getElementById('location-input').value = city;
    } catch {}
    performSearch();
  } catch (err) { alert(err.message); }
});

document.getElementById('location-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') performSearch();
});

document.getElementById('close-detail').addEventListener('click', hideVenueDetail);

// Dark mode toggle
function initTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('theme-toggle').textContent = '☀️';
  }
}

document.getElementById('theme-toggle').addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    document.getElementById('theme-toggle').textContent = '🌙';
    localStorage.setItem('theme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('theme-toggle').textContent = '☀️';
    localStorage.setItem('theme', 'dark');
  }
  switchMapTiles();
});

window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMap();
});

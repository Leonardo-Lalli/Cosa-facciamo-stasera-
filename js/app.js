// ===== Main App Controller (stable) =====
let sortListenerAttached = false;
let searchInProgress = false;
let heatmapLayer = null;

// ===== Geocode =====
async function geocode(query) {
  const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, { headers: { 'Accept-Language': 'it' } });
  const data = await resp.json();
  if (!data.length) throw new Error('Luogo non trovato');
  const a = data[0];
  return { lat: parseFloat(a.lat), lng: parseFloat(a.lon), city: a.address?.city || a.address?.town || a.address?.village || query, display: a.display_name };
}

// ===== Weather =====
async function fetchWeather(lat, lng) {
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&timezone=auto`);
    const d = await r.json();
    const code = d.current?.weather_code;
    const icons = {0:'☀️ Sereno',1:'🌤️ Sereno',2:'⛅ Nuvoloso',3:'☁️ Nuvoloso',45:'🌫️ Nebbia',51:'🌧️ Pioggia',61:'🌧️ Pioggia',71:'❄️ Neve',80:'🌦️ Rovesci',95:'⛈️ Temporale'};
    return { temp: Math.round(d.current?.temperature_2m), desc: icons[code] || '⛅', wind: d.current?.wind_speed_10m };
  } catch { return null; }
}

function showWeather(w, city) {
  const el = S('weather-widget');
  if (!el) return;
  if (!w) { el.classList.add('hidden'); return; }
  el.innerHTML = `${w.desc} · ${w.temp}°C · 💨 ${w.wind} km/h <span style="opacity:0.6">a ${city||''}</span>`;
  el.classList.remove('hidden');
}

// ===== Enrich data =====
async function loadEnrichedVenues(city) {
  if (!city) return [];
  try {
    const r = await fetch(`data/cities/${city.toLowerCase().replace(/[^a-z0-9]/g,'-')}.json`);
    if (!r.ok) return [];
    return (await r.json()).venues || [];
  } catch { return []; }
}

async function loadEvents(city) {
  try {
    const r = await fetch('data/events.json');
    if (!r.ok) return [];
    const events = await r.json();
    const cn = (city||'').toLowerCase();
    return events.filter(e => (e.city||'').toLowerCase().includes(cn) || cn.includes((e.city||'').toLowerCase()));
  } catch { return []; }
}

function mergeVenues(osm, extra) {
  const seen = new Set();
  osm.forEach(v => seen.add(`${v.name}|${v.lat?.toFixed(4)}|${v.lng?.toFixed(4)}`));
  const added = extra.filter(v => {
    const k = `${v.name}|${v.lat?.toFixed(4)}|${v.lng?.toFixed(4)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).map(v => ({
    id:v.id, lat:v.lat, lng:v.lng, name:v.name, address:v.address||'', type:v.type,
    icon:({nightclub:'🪩',bar:'🍺',pub:'🍻',cinema:'🎬',theatre:'🎭',restaurant:'🍽️',live_music:'🎵',bowling:'🎳',events_venue:'🎪',dance_hall:'💃',casino:'🎰',arcade:'🕹️',karaoke:'🎤'})[v.type]||'📍',
    label:v.label||v.type, website:v.website||null, rating:v.rating||null, source:'google'
  }));
  return [...osm, ...added];
}

// ===== GPS =====
function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocalizzazione non supportata'));
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject(new Error('Posizione non disponibile'))
    );
  });
}

// ===== Main Search =====
async function performSearch() {
  if (searchInProgress) return;
  searchInProgress = true;

  const types = Array.from(document.querySelectorAll('#type-filters .chip.active')).map(c => c.dataset.type);
  if (!types.length) { alert('Seleziona almeno un tipo di locale'); searchInProgress = false; return; }

  const input = (S('location-input')?.value || '').trim();
  if (!input && !userLocation) { alert('Inserisci una città o clicca 📍'); searchInProgress = false; return; }
  if (typeof blockExplore !== 'undefined') blockExplore(8000);

  showEl('loading');
  clearVenueMarkers();
  if (typeof hideVenueDetail === 'function') hideVenueDetail();

  try {
    if (input && (!userLocation || userLocation.display !== input)) {
      userLocation = await geocode(input);
      setUserLocation(userLocation.lat, userLocation.lng);
      drawRadiusCircle(userLocation, parseInt(S('radius-slider')?.value || 10));
      const w = await fetchWeather(userLocation.lat, userLocation.lng);
      showWeather(w, userLocation.city);
    }

    const radius = parseInt(S('radius-slider')?.value || 10);
    const osmVenues = await fetchVenues(userLocation, radius, types);

    const [enriched, events] = await Promise.all([
      loadEnrichedVenues(userLocation.city).catch(() => []),
      loadEvents(userLocation.city).catch(() => []),
    ]);

    const venues = mergeVenues(osmVenues, enriched);
    window._allVenues = venues;
    window._events = events;

    if (!venues.length) {
      hideEl('loading');
      renderVenueList([], {}, () => {}, []);
      clearVenueMarkers();
      searchInProgress = false;
      return;
    }

    // Estimate routes
    const estRoutes = {};
    venues.forEach(v => { estRoutes[v.id] = { walking: { duration: Math.round(haversineKm(userLocation, v) / 5 * 60), distance: haversineKm(userLocation, v).toFixed(1) } }; });
    window._venueRoutes = estRoutes;

    // Render
    addClass('sidebar', 'results-mode');
    showEl('filters-toggle');
    setText('filters-toggle', '⚙️ Filtri ▸');
    addClass('filters-wrap', 'collapsed');
    showEl('planner-section');
    showEl('heatmap-toggle');
    showEl('heatmap-fab');

    saveScrollPosition();
    sortAndRender(venues, estRoutes);
    restoreScrollPosition();

    addVenueMarkers(venues, venue => {
      showVenueDetail(venue, window._venueRoutes);
      highlightVenueCard(venue);
      highlightMarker(venue.id);
    });
    fitBounds(venues);

    // Background: real routes
    updateRoutesInBackground(venues);
    // Background: AI plan (deferred)
    setTimeout(() => { if (typeof autoLoadPlan === 'function') autoLoadPlan(); }, 800);
    searchInProgress = false;

  } catch (err) {
    searchInProgress = false;
    hideEl('loading');
    console.error(err);
    alert('Errore: ' + (err.message || 'Riprova'));
  }
}

async function updateRoutesInBackground(venues) {
  try {
    const dests = venues.map(v => ({ lat: v.lat, lng: v.lng }));
    const batch = await getRoutesForModes(userLocation, dests);
    const real = {};
    venues.forEach((v, i) => { real[v.id] = batch[i] || {}; });
    window._venueRoutes = real;
  } catch {}
}

// ===== Sort & Render =====
function saveScrollPosition() {
  const el = S('venue-list');
  if (el) el.dataset.scrollTop = el.scrollTop;
}
function restoreScrollPosition() {
  const el = S('venue-list');
  if (el?.dataset.scrollTop) requestAnimationFrame(() => { el.scrollTop = parseInt(el.dataset.scrollTop); });
}

function sortAndRender(venues, routes) {
  const sortBy = S('sort-select')?.value || 'distance';
  const sorted = [...venues];
  if (sortBy === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'it'));
  else if (sortBy === 'time') sorted.sort((a, b) => (routes[a.id]?.walking?.duration || 999) - (routes[b.id]?.walking?.duration || 999));
  else sorted.sort((a, b) => parseFloat(routes[a.id]?.walking?.distance || 999) - parseFloat(routes[b.id]?.walking?.distance || 999));
  window._lastVenues = sorted;

  renderVenueList(sorted, routes, venue => {
    showVenueDetail(venue, routes);
    highlightVenueCard(venue);
    highlightMarker(venue.id);
  }, window._events || []);

  if (window._onResultsReady) window._onResultsReady();

  if (!sortListenerAttached) {
    sortListenerAttached = true;
    S('sort-select')?.addEventListener('change', () => {
      saveScrollPosition();
      sortAndRender(window._lastVenues || sorted, window._venueRoutes || routes);
      restoreScrollPosition();
    });
  }
}

function highlightVenueCard(venue) {
  document.querySelectorAll('.venue-card.active').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.venue-card').forEach(card => {
    if (card.querySelector('.venue-name')?.textContent === venue.name) {
      card.classList.add('active');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}

// ===== Random picker =====
function pickRandom() {
  const venues = window._allVenues;
  if (!venues?.length) { alert('Prima cerca dei locali!'); return; }
  const pick = venues[Math.floor(Math.random() * venues.length)];
  showVenueDetail(pick, window._venueRoutes || {});
  highlightVenueCard(pick);
  highlightMarker(pick.id);
}

// ===== Event listeners =====
S('search-btn')?.addEventListener('click', performSearch);
S('random-btn')?.addEventListener('click', pickRandom);

S('locate-btn')?.addEventListener('click', async () => {
  try {
    const pos = await getCurrentPosition();
    userLocation = pos;
    setUserLocation(pos.lat, pos.lng);
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.lat}&lon=${pos.lng}`, { headers: { 'Accept-Language': 'it' } });
    const d = await r.json();
    const city = d.address?.city || d.address?.town || '';
    if (city) setText('location-input', city);
    const w = await fetchWeather(pos.lat, pos.lng);
    showWeather(w, city);
    performSearch();
  } catch (e) { alert(e.message); }
});

S('location-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') performSearch(); });
S('close-detail')?.addEventListener('click', () => { if (typeof hideVenueDetail === 'function') hideVenueDetail(); });

// Back button
S('back-btn')?.addEventListener('click', () => {
  removeClass('sidebar', 'results-mode');
  removeClass('filters-wrap', 'collapsed');
  hideEl('filters-toggle');
  hideEl('planner-section');
  hideEl('heatmap-toggle');
  hideEl('heatmap-fab');
  hideEl('weather-widget');
  hideEl('results-header');
  if (S('venue-list')) S('venue-list').innerHTML = '';
  clearVenueMarkers();
  if (typeof hideVenueDetail === 'function') hideVenueDetail();
  if (heatmapLayer) { map.removeLayer(heatmapLayer); heatmapLayer = null; }
});

// ===== Heatmap =====
S('heatmap-btn')?.addEventListener('click', toggleHeatmap);
S('heatmap-fab')?.addEventListener('click', toggleHeatmap);

function toggleHeatmap() {
  const venues = window._allVenues;
  if (!venues?.length || typeof L === 'undefined' || !L.heatLayer) return;
  if (heatmapLayer) {
    map.removeLayer(heatmapLayer); heatmapLayer = null;
    setText('heatmap-btn', '📊 Mostra heatmap');
    removeClass('heatmap-fab', 'active');
  } else {
    heatmapLayer = L.heatLayer(venues.map(v => [v.lat, v.lng, 0.5]), { radius: 25, blur: 15, maxZoom: 17 }).addTo(map);
    setText('heatmap-btn', '📊 Nascondi heatmap');
    addClass('heatmap-fab', 'active');
  }
}

// ===== Dark mode =====
function initTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    setText('theme-toggle', '☀️');
  }
}

S('theme-toggle')?.addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    setText('theme-toggle', '🌙');
    localStorage.setItem('theme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    setText('theme-toggle', '☀️');
    localStorage.setItem('theme', 'dark');
  }
  if (typeof switchMapTiles === 'function') switchMapTiles();
});

// ===== Init =====
window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  if (typeof initMap === 'function') initMap();
  if (typeof enableExploreMode === 'function') enableExploreMode();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  // Filters toggle
  const ft = S('filters-toggle');
  const fw = S('filters-wrap');
  if (ft && fw) {
    ft.addEventListener('click', () => {
      fw.classList.toggle('collapsed');
      ft.textContent = fw.classList.contains('collapsed') ? '⚙️ Filtri ▸' : '⚙️ Filtri ▾';
    });
  }

  // Planner toggle
  const pb = S('planner-btn');
  if (pb) {
    pb.addEventListener('click', () => {
      const po = S('planner-output');
      if (!po) return;
      po.style.display = po.style.display === 'none' ? '' : 'none';
      pb.textContent = po.style.display === 'none' ? 'Mostra' : 'Nascondi';
    });
  }

  // Mobile drawer
  const drawer = S('results-drawer');
  if (drawer && window.innerWidth <= 768) {
    const handle = drawer.querySelector('.drawer-handle');
    let startY = 0;
    function expand() { drawer.classList.add('expanded'); }
    function collapse() { drawer.classList.remove('expanded'); }
    if (handle) {
      handle.addEventListener('click', () => drawer.classList.toggle('expanded'));
      handle.addEventListener('touchstart', e => { startY = e.touches[0].clientY; });
      handle.addEventListener('touchend', e => {
        const diff = startY - e.changedTouches[0].clientY;
        if (diff > 30) expand();
        else if (diff < -30) collapse();
      });
    }
    window._onResultsReady = () => expand();
  }
});

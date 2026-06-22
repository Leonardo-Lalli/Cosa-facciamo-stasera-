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
    return events.filter(e => (e.city || '').toLowerCase().includes(cn) || cn.includes((e.city || '').toLowerCase()));
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

function getEnrichedIcon(type) {
  const m = { nightclub:'🪩', pub:'🍻', bar:'🍺', cinema:'🎬', theatre:'🎭', live_music:'🎵', dance_hall:'💃', events_venue:'🎪', restaurant:'🍽️', bowling:'🎳', casino:'🎰', arcade:'🕹️', karaoke:'🎤' };
  return m[type] || '📍';
}
function getEnrichedLabel(type) {
  const m = { nightclub:'Discoteca', pub:'Pub', bar:'Bar', cinema:'Cinema', theatre:'Teatro', live_music:'Musica dal vivo', dance_hall:'Ballo', events_venue:'Sale eventi', restaurant:'Ristorante', bowling:'Bowling', casino:'Casinò', arcade:'Sala giochi', karaoke:'Karaoke' };
  return m[type] || type;
}

let sortListenerAttached = false;

// ===== Weather (Open-Meteo, free, no API key) =====
async function fetchWeather(lat, lng) {
  try {
    const resp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`);
    const d = await resp.json();
    const code = d.current?.weather_code;
    const icons = { 0:'☀️ Sereno',1:'🌤️ Sereno',2:'⛅ Parzialmente nuvoloso',3:'☁️ Nuvoloso',45:'🌫️ Nebbia',48:'🌫️ Nebbia',51:'🌧️ Pioggerella',53:'🌧️ Pioggerella',55:'🌧️ Pioggerella',61:'🌧️ Pioggia',63:'🌧️ Pioggia',65:'🌧️ Pioggia forte',71:'❄️ Neve',73:'❄️ Neve',75:'❄️ Neve forte',80:'🌦️ Rovesci',81:'🌦️ Rovesci',82:'🌦️ Rovesci forti',95:'⛈️ Temporale',96:'⛈️ Temporale grandine',99:'⛈️ Temporale grandine' };
    return { temp: Math.round(d.current?.temperature_2m), desc: icons[code] || '🌈', wind: d.current?.wind_speed_10m };
  } catch { return null; }
}

function showWeather(weather, city) {
  const w = document.getElementById('weather-widget');
  if (!weather) { w.classList.add('hidden'); return; }
  w.innerHTML = `${weather.desc} · ${weather.temp}°C · 💨 ${weather.wind} km/h <span style="font-size:10px;opacity:0.6">a ${city}</span>`;
  w.classList.remove('hidden');
}

// ===== Perform Search =====
async function performSearch() {
  const filters = getFilters();
  if (filters.types.length === 0 && !favoritesActive) { alert('Seleziona almeno un tipo di locale'); return; }

  const locationInput = document.getElementById('location-input').value.trim();
  if (!locationInput && !userLocation) { alert('Inserisci una città o clicca 📍'); return; }

  showLoading();
  clearVenueMarkers();
  hideVenueDetail();

  try {
    if (locationInput && (!userLocation || userLocation.display !== locationInput)) {
      const loc = await geocode(locationInput);
      userLocation = loc;
      setUserLocation(loc.lat, loc.lng);
      drawRadiusCircle(loc, filters.radius);
      const w = await fetchWeather(loc.lat, loc.lng);
      showWeather(w, loc.city);
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
    window._allVenues = venues;

    if (venues.length === 0) { hideLoading(); renderVenueList([], {}, () => {}, []); clearVenueMarkers(); return; }

    // Enter results mode
    document.getElementById('sidebar').classList.add('results-mode');
    document.getElementById('filters-toggle').classList.remove('hidden');
    document.getElementById('filters-toggle').textContent = '⚙️ Filtri ▸';
    document.getElementById('filters-wrap').classList.add('collapsed');

    // Show trending section
    showTrending();

    // New events badge
    const newEvents = checkNewEvents(userLocation?.city, events);
    if (newEvents.length > 0) {
      const badge = document.createElement('span');
      badge.className = 'new-events-badge';
      badge.textContent = `🆕 ${newEvents.length} nuovi eventi`;
      badge.style.cssText = 'font-size:11px;background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:10px;margin-left:8px;';
      document.getElementById('results-count').appendChild(badge);
      markEventsSeen(newEvents);
    }

    const estRoutes = {};
    venues.forEach(v => {
      estRoutes[v.id] = { walking: estimate({ lat: userLocation.lat, lng: userLocation.lng }, { lat: v.lat, lng: v.lng }, 'walking') };
    });

    saveScrollPosition();
    sortAndRender(venues, estRoutes);
    restoreScrollPosition();

    document.getElementById('planner-section').classList.remove('hidden');
    document.getElementById('heatmap-toggle').classList.remove('hidden');
    document.getElementById('heatmap-fab').classList.remove('hidden');

    // Auto-load AI plan
    autoLoadPlan();

    addVenueMarkers(venues, venue => {
      const routes = window._venueRoutes || estRoutes;
      showVenueDetail(venue, routes);
      highlightVenueCard(venue);
      highlightMarker(venue.id);
    });
    fitBounds(venues);

    const dests = venues.map(v => ({ lat: v.lat, lng: v.lng }));
    const batchRoutes = await getRoutesForModes({ lat: userLocation.lat, lng: userLocation.lng }, dests);
    const realRoutes = {};
    venues.forEach((v, i) => { realRoutes[v.id] = batchRoutes[i] || {}; });
    window._venueRoutes = realRoutes;

    saveScrollPosition();
    sortAndRender(venues, realRoutes);
    restoreScrollPosition();

  } catch (err) {
    hideLoading();
    console.error(err);
    const msg = err.message || '';
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch')) {
      alert('Errore di connessione. Riprova tra qualche secondo.');
    } else if (msg.includes('Overpass')) {
      alert('Server Overpass momentaneamente occupato. Riprova.');
    } else {
      alert('Errore: ' + msg);
    }
  }
}

function saveScrollPosition() {
  const list = document.getElementById('venue-list');
  if (list) list.dataset.scrollTop = list.scrollTop;
}
function restoreScrollPosition() {
  const list = document.getElementById('venue-list');
  if (list && list.dataset.scrollTop) { requestAnimationFrame(() => { list.scrollTop = parseInt(list.dataset.scrollTop); }); }
}

function sortAndRender(venues, routes) {
  const sortBy = document.getElementById('sort-select').value;
  const sorted = [...venues];
  if (sortBy === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'it'));
  else if (sortBy === 'time') sorted.sort((a, b) => getBestTime(routes[a.id]) - getBestTime(routes[b.id]));
  else sorted.sort((a, b) => getBestDist(routes[a.id]) - getBestDist(routes[b.id]));
  window._lastVenues = sorted;

  renderVenueList(sorted, routes, venue => {
    showVenueDetail(venue, routes);
    highlightVenueCard(venue);
    highlightMarker(venue.id);
  }, window._events || []);

  if (window._onResultsReady) window._onResultsReady();

  if (!sortListenerAttached) {
    sortListenerAttached = true;
    document.getElementById('sort-select').addEventListener('change', () => {
      saveScrollPosition();
      sortAndRender(window._lastVenues || sorted, window._venueRoutes || routes);
      restoreScrollPosition();
    });
  }
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

// ===== Trending =====
function showTrending() {
  const trending = getTrending();
  if (trending.length === 0) return;
  const venues = window._allVenues || [];
  const items = trending
    .map(([id, count]) => venues.find(v => v.id == id))
    .filter(Boolean)
    .slice(0, 3);

  if (items.length === 0) return;

  let section = document.getElementById('trending-section');
  if (!section) {
    section = document.createElement('div');
    section.id = 'trending-section';
    section.className = 'trending-section';
    const resultsHeader = document.getElementById('results-header');
    resultsHeader.parentNode.insertBefore(section, resultsHeader.nextSibling);
  }

  section.innerHTML = `
    <div class="trending-header">🔥 I più cliccati</div>
    ${items.map(v => `
      <div class="trending-item" style="cursor:pointer" data-id="${v.id}">
        <span>${v.icon}</span> <span>${v.name}</span>
        <span style="margin-left:auto;font-size:11px;color:var(--text-muted)">${v.label}</span>
      </div>
    `).join('')}
  `;

  section.querySelectorAll('.trending-item').forEach(el => {
    el.addEventListener('click', () => {
      const v = venues.find(v => v.id == el.dataset.id);
      if (v) {
        showVenueDetail(v, window._venueRoutes || {});
        highlightVenueCard(v);
        highlightMarker(v.id);
      }
    });
  });
}
function pickRandom() {
  const venues = window._allVenues;
  if (!venues || venues.length === 0) { alert('Prima cerca dei locali!'); return; }
  const filtered = getFilteredVenues(venues);
  if (filtered.length === 0) { alert('Nessun locale trovato coi filtri attuali!'); return; }
  const pick = filtered[Math.floor(Math.random() * filtered.length)];
  showVenueDetail(pick, window._venueRoutes || {});
  highlightVenueCard(pick);
  highlightMarker(pick.id);
}

// ===== Auto-load AI Plan =====
async function autoLoadPlan() {
  const plannerOutput = document.getElementById('planner-output');
  const plannerBtn = document.getElementById('planner-btn');
  if (!plannerOutput || !plannerBtn) return;

  plannerOutput.textContent = '🔄 Preparo il tuo piano...';
  plannerOutput.style.display = '';
  plannerBtn.style.display = 'none';

  const result = await loadCityPlan(userLocation?.city);
  let plans = null;

  if (result?.plans && Object.keys(result.plans).length > 0) {
    plans = result.plans;
  } else {
    const smart = buildSmartPlan(window._lastVenues || [], userLocation?.city);
    if (smart?.plans) plans = smart.plans;
  }

  if (plans) {
    const keys = Object.keys(plans);
    const types = getFilters().types;
    let bestKey = keys[0];
    if (types.every(t => ['nightclub','bar','pub','live_music'].includes(t))) bestKey = 'party';
    else if (types.every(t => ['cinema','theatre','live_music','events_venue'].includes(t))) bestKey = 'culture';
    else if (types.every(t => ['restaurant','bar','pub'].includes(t))) bestKey = 'foodie';
    if (!plans[bestKey]) bestKey = keys[0];

    const tabsHtml = keys.map(k => {
      const p = plans[k];
      return `<button class="plan-tab${k === bestKey ? ' active' : ''}" data-tab="${k}">${p.emoji} ${p.label}</button>`;
    }).join('');
    plannerOutput.innerHTML = `<div class="plan-tabs">${tabsHtml}</div><div class="plan-content">${plans[bestKey].text}</div>`;

    plannerOutput.querySelectorAll('.plan-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        plannerOutput.querySelectorAll('.plan-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        plannerOutput.querySelector('.plan-content').textContent = plans[tab.dataset.tab].text;
      });
    });
  } else {
    plannerOutput.innerHTML = '<div style="padding:6px;text-align:center;font-size:11px;color:var(--text-secondary)">Cerca per vedere il piano serata</div>';
  }
}

// Event listeners
document.getElementById('search-btn').addEventListener('click', performSearch);
document.getElementById('random-btn').addEventListener('click', pickRandom);

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
      const w = await fetchWeather(pos.lat, pos.lng);
      showWeather(w, city);
    } catch {}
    performSearch();
  } catch (err) { alert(err.message); }
});

document.getElementById('location-input').addEventListener('keydown', e => { if (e.key === 'Enter') performSearch(); });
document.getElementById('close-detail').addEventListener('click', hideVenueDetail);

// Back button - exit results mode
document.getElementById('back-btn').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('results-mode');
  document.getElementById('filters-wrap').classList.remove('collapsed');
  document.getElementById('filters-toggle').classList.add('hidden');
  document.getElementById('planner-section').classList.add('hidden');
  document.getElementById('heatmap-toggle').classList.add('hidden');
  document.getElementById('heatmap-fab').classList.add('hidden');
  document.getElementById('weather-widget').classList.add('hidden');
  document.getElementById('results-header').classList.add('hidden');
  document.getElementById('venue-list').innerHTML = '';
  clearVenueMarkers();
  hideVenueDetail();
  if (heatmapLayer) { map.removeLayer(heatmapLayer); heatmapLayer = null; }
});

// Dark mode
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
  if (isDark) { document.documentElement.removeAttribute('data-theme'); document.getElementById('theme-toggle').textContent = '🌙'; localStorage.setItem('theme', 'light'); }
  else { document.documentElement.setAttribute('data-theme', 'dark'); document.getElementById('theme-toggle').textContent = '☀️'; localStorage.setItem('theme', 'dark'); }
  switchMapTiles();
});

// Heatmap toggle
let heatmapLayer = null;
document.getElementById('heatmap-btn').addEventListener('click', toggleHeatmap);
document.getElementById('heatmap-fab').addEventListener('click', toggleHeatmap);

function toggleHeatmap() {
  const venues = window._allVenues;
  if (!venues || venues.length === 0) return;
  if (heatmapLayer) { map.removeLayer(heatmapLayer); heatmapLayer = null; document.getElementById('heatmap-btn').textContent = '📊 Mostra heatmap'; document.getElementById('heatmap-fab').classList.remove('active'); return; }
  const points = venues.map(v => [v.lat, v.lng, 0.5]);
  heatmapLayer = L.heatLayer(points, { radius: 25, blur: 15, maxZoom: 17, max: 1.0 }).addTo(map);
  document.getElementById('heatmap-btn').textContent = '📊 Nascondi heatmap';
  document.getElementById('heatmap-fab').classList.add('active');
}

window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMap();
  enableExploreMode();
  if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js').catch(() => {}); }

  // Filters toggle
  const filtersToggle = document.getElementById('filters-toggle');
  const filtersWrap = document.getElementById('filters-wrap');
  filtersToggle.addEventListener('click', () => {
    filtersWrap.classList.toggle('collapsed');
    filtersToggle.textContent = filtersWrap.classList.contains('collapsed') ? '⚙️ Filtri ▸' : '⚙️ Filtri ▾';
  });

  // Planner button: just toggle visibility
  document.getElementById('planner-btn').addEventListener('click', () => {
    const po = document.getElementById('planner-output');
    if (!po) return;
    const isHidden = po.style.display === 'none';
    po.style.display = isHidden ? '' : 'none';
    document.getElementById('planner-btn').textContent = isHidden ? 'Nascondi' : 'Mostra';
  });

  // Mobile drawer
  const drawer = document.getElementById('results-drawer');
  const drawerHandle = drawer.querySelector('.drawer-handle');
  const mobileFab = document.getElementById('mobile-fab');
  let drawerExpanded = false;

  function toggleDrawer() {
    drawerExpanded = !drawerExpanded;
    drawer.classList.toggle('expanded', drawerExpanded);
    mobileFab.textContent = drawerExpanded ? '🗺️ Mappa' : '📋 Lista locali';
  }

  drawerHandle.addEventListener('click', toggleDrawer);
  mobileFab.addEventListener('click', toggleDrawer);

  // Auto-expand drawer when results appear on mobile
  const origSortAndRender = window.sortAndRender;
  window._onResultsReady = () => {
    if (window.innerWidth <= 768) {
      drawer.classList.remove('hidden');
      drawerExpanded = true;
      drawer.classList.add('expanded');
      mobileFab.style.display = 'flex';
      mobileFab.textContent = '🗺️ Mappa';
    }
  };
});

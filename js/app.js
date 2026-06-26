// ===== Main App Controller (stable) =====
let sortListenerAttached = false;
let searchInProgress = false;

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
    } else if (userLocation) {
      drawRadiusCircle(userLocation, parseInt(S('radius-slider')?.value || 10));
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
    if (typeof trackCity === 'function') trackCity(userLocation.city);

    if (!venues.length) {
      hideEl('loading');
      renderVenueList([], {}, () => {}, []);
      clearVenueMarkers();
      searchInProgress = false;
      return;
    }

    // Estimate routes for all 4 modes
    const estRoutes = {};
    const speeds = { walking: 5, cycling: 15, transit: 25, driving: 40 };
    venues.forEach(v => {
      const dist = haversineKm(userLocation, v);
      estRoutes[v.id] = {};
      Object.entries(speeds).forEach(([mode, speed]) => {
        estRoutes[v.id][mode] = { duration: Math.round(dist / speed * 60), distance: dist.toFixed(1) };
      });
    });
    window._venueRoutes = estRoutes;

    // Render
    addClass('sidebar', 'results-mode');
    if (window.innerWidth > 768) {
      showEl('filters-toggle');
      setText('filters-toggle', '⚙️ Filtri ▸');
      addClass('filters-wrap', 'collapsed');
    }

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
  hideEl('weather-widget');
  hideEl('results-header');
  if (S('venue-list')) S('venue-list').innerHTML = '';
  clearVenueMarkers();
  if (typeof hideVenueDetail === 'function') hideVenueDetail();
});

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
  initLanding();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
});

// ===== Landing Page =====
const LANDING_VERBS = [
  'facciamo', 'guardiamo', 'mangiamo', 'balliamo', 'beviamo',
  'ascoltiamo', 'giochiamo', 'cantiamo', 'vediamo', 'festeggiamo'
];

let _landingVerbIdx = 0;
let _landingTimer, _landingAbort;

function typewriteLanding(el, newWord, done) {
  if (_landingAbort) { _landingAbort(); _landingAbort = null; }
  if (_landingTimer) { clearTimeout(_landingTimer); _landingTimer = null; }
  const cur = el.textContent;
  if (cur === newWord) { if (done) done(); return; }
  let i = cur.length, cancelled = false;
  _landingAbort = () => { cancelled = true; };
  function erase() {
    if (cancelled) return;
    if (i <= 0) {
      el.textContent = ''; let j = 0;
      function write() {
        if (cancelled) return;
        if (j <= newWord.length) { el.textContent = newWord.slice(0, j); j++; _landingTimer = setTimeout(write, 55); }
        else { _landingTimer = null; _landingAbort = null; if (done) done(); }
      }
      write();
      return;
    }
    el.textContent = cur.slice(0, i - 1); i--;
    _landingTimer = setTimeout(erase, 30);
  }
  erase();
}

function cycleLandingVerb() {
  const el = S('landing-verb');
  if (!el) return;
  _landingVerbIdx = (_landingVerbIdx + 1) % LANDING_VERBS.length;
  typewriteLanding(el, LANDING_VERBS[_landingVerbIdx], () => {
    _landingTimer = setTimeout(cycleLandingVerb, 1800);
  });
}

// Load events for landing page
async function loadLandingEvents() {
  try {
    const r = await fetch('data/events.json');
    if (!r.ok) return;
    const events = await r.json();
    if (!events.length) return;
    
    // Group by city, take top 6 cities, 1 event each
    const byCity = {};
    events.forEach(ev => {
      const c = ev.city || 'Italia';
      if (!byCity[c]) byCity[c] = [];
      if (byCity[c].length < 2) byCity[c].push(ev);
    });
    const cities = Object.keys(byCity).slice(0, 6);
    const shown = cities.map(c => byCity[c][0]).filter(Boolean);
    
    if (!shown.length) return;
    
    const wrap = S('landing-events');
    const list = S('landing-events-list');
    if (!wrap || !list) return;
    wrap.classList.remove('hidden');
    
    shown.forEach(ev => {
      const dateStr = ev.date ? new Date(ev.date).toLocaleDateString('it-IT', { day:'numeric', month:'short' }) : 'TBA';
      const card = document.createElement('div');
      card.className = 'landing-event-card';
      card.innerHTML = `
        <div class="landing-event-date">${dateStr}</div>
        <div class="landing-event-info">
          <div class="landing-event-name">${ev.name}</div>
          <div class="landing-event-venue">📍 ${ev.venue || ''}</div>
        </div>
        <div class="landing-event-city">${ev.city || ''}</div>
      `;
      card.addEventListener('click', () => {
        if (ev.url) window.open(ev.url, '_blank');
      });
      list.appendChild(card);
    });
  } catch {}
}

function initLanding() {
  const landing = S('landing');
  const cta = S('landing-cta');
  if (!landing || !cta) return;

  // Start verb cycling
  _landingTimer = setTimeout(cycleLandingVerb, 1200);

  // Load events
  loadLandingEvents();

  cta.addEventListener('click', () => {
    // Clean up landing timers
    if (_landingTimer) clearTimeout(_landingTimer);
    if (_landingAbort) _landingAbort();

    // Fade out landing
    landing.classList.add('fade-out');

    // Init app after transition
    setTimeout(() => {
      if (landing.parentNode) landing.style.display = 'none';
      document.getElementById('app').classList.remove('app-hidden');
      document.getElementById('app').classList.add('app-visible');
      initMap();
      setupAppUI();
    }, 400);
  });
}

function setupAppUI() {
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
    const filters = S('filters-wrap');
    if (filters) {
      drawer.insertBefore(filters, drawer.querySelector('.drawer-handle').nextSibling);
      filters.classList.add('in-drawer');
      filters.classList.remove('collapsed');
    }

    const handle = drawer.querySelector('.drawer-handle');
    let startY = 0, dragging = false;

    function expand() { drawer.classList.add('expanded'); }
    function collapse() { drawer.classList.remove('expanded'); }

    if (handle) {
      handle.addEventListener('click', () => {
        drawer.classList.contains('expanded') ? collapse() : expand();
      });
    }
    drawer.addEventListener('touchstart', e => {
      const el = e.target.closest('.drawer-handle');
      if (!el) {
        const vl = S('venue-list');
        if (vl && (vl === e.target || vl.contains(e.target))) { dragging = false; return; }
        const fw2 = drawer.querySelector('.filters');
        if (fw2 && (fw2 === e.target || fw2.contains(e.target))) { dragging = false; return; }
      }
      startY = e.touches[0].clientY; dragging = true;
    }, { passive: true });
    drawer.addEventListener('touchmove', e => {
      if (!dragging) return;
      const diff = startY - e.touches[0].clientY;
      if (diff > 50) expand();
      else if (diff < -50) collapse();
    }, { passive: true });
    drawer.addEventListener('touchend', () => { dragging = false; });

    window._onResultsReady = () => {
      filters.classList.add('collapsed');
      setTimeout(expand, 300);
    };
  }
}

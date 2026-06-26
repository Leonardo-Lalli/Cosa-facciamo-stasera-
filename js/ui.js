// ===== UI Module =====
let selectedModes = ['walking'];
let selectedTypes = ['nightclub', 'bar', 'pub', 'cinema', 'theatre', 'restaurant'];
let currentVenues = [];
let currentRoutes = {};
let openNowActive = false;
let weekendActive = false;
let favoritesActive = false;

// Transport
document.querySelectorAll('.transport-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
    selectedModes = Array.from(document.querySelectorAll('.transport-btn.active')).map(b => b.dataset.mode);
  });
});

// Typewriter
const VERB_MAP = {
  cinema:'guardiamo', restaurant:'mangiamo', nightclub:'balliamo',
  bar:'beviamo', pub:'beviamo', theatre:'vediamo',
  live_music:'ascoltiamo', bowling:'giochiamo', dance_hall:'balliamo',
  casino:'giochiamo', arcade:'giochiamo', karaoke:'cantiamo',
  events_venue:'festeggiamo',
};

let typewriterTimer, typewriterAbort;

function animateVerb(newVerb) {
  const el = document.getElementById('verb');
  if (!el || !document.body.contains(el)) return;
  if (typewriterAbort) { typewriterAbort(); typewriterAbort = null; }
  if (typewriterTimer) { clearTimeout(typewriterTimer); typewriterTimer = null; }
  const cur = el.textContent;
  if (cur === newVerb) return;
  el.classList.add('typing');
  let i = cur.length, cancelled = false;
  typewriterAbort = () => { cancelled = true; el.classList.remove('typing'); };
  function erase() {
    if (cancelled) return;
    if (i <= 0) {
      el.textContent = ''; let j = 0;
      function write() {
        if (cancelled) return;
        if (j <= newVerb.length) { el.textContent = newVerb.slice(0, j); j++; typewriterTimer = setTimeout(write, 50); }
        else { el.classList.remove('typing'); typewriterTimer = null; typewriterAbort = null; }
      }
      write();
      return;
    }
    el.textContent = cur.slice(0, i - 1) + '\u200B'; i--;
    typewriterTimer = setTimeout(erase, 35);
  }
  erase();
}

// Type chips
document.querySelectorAll('#type-filters .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    chip.classList.toggle('active');
    selectedTypes = Array.from(document.querySelectorAll('#type-filters .chip.active')).map(c => c.dataset.type);
    setTimeout(() => {
      animateVerb(selectedTypes.length === 1 ? (VERB_MAP[selectedTypes[0]] || 'facciamo') : 'facciamo');
    }, 100);
    if (favoritesActive) { favoritesActive = false; updateSpecialChips(); }
  });
});

// Special chips: open now, weekend, favorites
function updateSpecialChips() {
  toggleClass('chip-opennow', 'active', openNowActive);
  toggleClass('chip-weekend', 'active', weekendActive);
  toggleClass('chip-favorites', 'active', favoritesActive);
  if (favoritesActive) {
    document.querySelectorAll('#type-filters .chip.active').forEach(c => c.classList.remove('active'));
    selectedTypes = [];
  }
}

document.getElementById('chip-opennow')?.addEventListener('click', () => {
  openNowActive = !openNowActive;
  if (openNowActive) { weekendActive = false; favoritesActive = false; }
  updateSpecialChips();
  if (window._lastVenues) {
    window._lastVenues = window._allVenues || window._lastVenues;
    sortAndRender(window._lastVenues, window._venueRoutes || {});
  }
});

document.getElementById('chip-weekend')?.addEventListener('click', () => {
  weekendActive = !weekendActive;
  if (weekendActive) { openNowActive = false; favoritesActive = false; }
  updateSpecialChips();
  if (window._lastVenues) {
    window._lastVenues = window._allVenues || window._lastVenues;
    sortAndRender(window._lastVenues, window._venueRoutes || {});
  }
});

document.getElementById('chip-favorites')?.addEventListener('click', () => {
  favoritesActive = !favoritesActive;
  if (favoritesActive) { openNowActive = false; weekendActive = false; }
  updateSpecialChips();
  if (favoritesActive) {
    // Load favorites as if they were search results
    const favs = getFavorites();
    if (favs.length > 0) {
      window._allVenues = favs;
      window._lastVenues = favs;
      window._venueRoutes = {};
      favs.forEach(f => { window._venueRoutes[f.id] = { walking: null }; });
      // Enter results mode UI
      addClass('sidebar', 'results-mode');
      showEl('filters-toggle');
      setText('filters-toggle', '⚙️ Filtri ▸');
      addClass('filters-wrap', 'collapsed');
      showEl('results-header');
      document.querySelectorAll('.venue-card.active').forEach(c => c.classList.remove('active'));
      sortAndRender(favs, window._venueRoutes);
      addVenueMarkers(favs, venue => {
        showVenueDetail(venue, window._venueRoutes);
        highlightVenueCard(venue);
        highlightMarker(venue.id);
      });
      fitBounds(favs);
    } else {
      alert('Nessun preferito salvato. Clicca ☆ su un locale per aggiungerlo.');
      favoritesActive = false;
      updateSpecialChips();
    }
  } else {
    // Exit favorites, go back to previous results or clear
    if (window._allVenues && window._allVenues.length > getFavorites().length) {
      sortAndRender(window._allVenues, window._venueRoutes || {});
    }
  }
});

// Favorites
function getFavorites() {
  try { return JSON.parse(localStorage.getItem('stasera_favs') || '[]'); } catch { return []; }
}
function saveFavorites(favs) { localStorage.setItem('stasera_favs', JSON.stringify(favs)); }
function toggleFavorite(venue) {
  const favs = getFavorites();
  const idx = favs.findIndex(f => f.id === venue.id);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push({ id: venue.id, name: venue.name, type: venue.type, icon: venue.icon, label: venue.label, address: venue.address, lat: venue.lat, lng: venue.lng, website: venue.website, rating: venue.rating });
  saveFavorites(favs);
}
function isFavorite(venueId) {
  return getFavorites().some(f => f.id === venueId);
}

function getFilteredVenues(venues) {
  let v = [...venues];
  if (openNowActive) v = v.filter(v => isOpenNow(v.openingHours));
  if (weekendActive) v = v.filter(v => isNextWeekend());
  if (favoritesActive) {
    const favs = getFavorites();
    v = favs;
  }
  return v;
}

function isOpenNow(hoursStr) {
  if (!hoursStr) return false;
  const now = new Date();
  const day = now.getDay() || 7; // 1=Mon, 7=Sun
  const mins = now.getHours() * 60 + now.getMinutes();
  const patterns = hoursStr.toLowerCase().split(';');
  const dayAbbr = ['', 'mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'];
  for (const p of patterns) {
    const clean = p.trim();
    const match = clean.match(/(?:([a-z]{2})(?:-([a-z]{2}))?[ ,]+)?(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);
    if (!match) {
      if (clean === '24/7') return true;
      continue;
    }
    const [, fromDay, toDay, h1, m1, h2, m2] = match;
    const open = parseInt(h1) * 60 + parseInt(m1);
    let close = parseInt(h2) * 60 + parseInt(m2);
    if (close <= open) close += 24 * 60;
    if (fromDay) {
      const fd = dayAbbr.indexOf(fromDay);
      const td = toDay ? dayAbbr.indexOf(toDay) : fd;
      if (fd < 0 || td < 0) continue;
      if (day < fd || day > td) continue;
    }
    if (mins >= open && mins < close) return true;
  }
  return false;
}

function isNextWeekend() {
  const now = new Date();
  const d = now.getDay();
  if (d === 5 || d === 6) return true;
  if (d === 4 && now.getHours() >= 18) return true;
  return false;
}

// ===== Smart Tags =====
function getSmartTags(venue) {
  const tags = [];
  const t = venue.tags || {};
  const d = venue.description;
  const r = venue.rating || 0;

  if (r >= 4.5) tags.push({ e: '⭐', l: 'Top' });
  else if (r >= 4) tags.push({ e: '👍', l: 'Apprezzato' });

  if ((t.capacity && parseInt(t.capacity) > 50) || t.brewery === 'yes') tags.push({ e: '👥', l: 'Gruppi' });

  if (r >= 4.5 && ['restaurant', 'theatre'].includes(venue.type)) tags.push({ e: '🕯️', l: 'Romantico' });

  if (t['payment:cash'] === 'only' || (!t['payment:cards'] && !t['payment:credit_cards'])) tags.push({ e: '💶', l: 'Contanti' });

  if (t.outdoor_seating === 'yes' || t.outdoor_seating === 'terrace') tags.push({ e: '🌿', l: 'Terrazza' });

  if (t.wifi === 'yes' || t['internet_access'] === 'wlan') tags.push({ e: '📶', l: 'WiFi' });

  if (t.smoking === 'no') tags.push({ e: '🚭', l: 'No fumo' });

  if (t.live_music === 'yes') tags.push({ e: '🎸', l: 'Live' });

  if (venue.openingHours && isOpenNow(venue.openingHours)) tags.push({ e: '🟢', l: 'Aperto' });

  if (d?.cons?.some(c => c.includes('rumoroso'))) tags.push({ e: '🔊', l: 'Alto volume' });

  return tags.slice(0, 4);
}

// ===== Trending =====
function trackClick(venue) {
  try {
    const clicks = JSON.parse(localStorage.getItem('stasera_clicks') || '{}');
    clicks[venue.id] = (clicks[venue.id] || 0) + 1;
    const sorted = Object.entries(clicks).sort((a, b) => b[1] - a[1]).slice(0, 100);
    localStorage.setItem('stasera_clicks', JSON.stringify(Object.fromEntries(sorted)));
    const total = Object.values(clicks).reduce((a, b) => a + b, 0);
    if (total === 1) showAchievement('🎉 Prima scoperta!');
    if (total === 5) showAchievement('🔍 Esploratore: 5 locali visti');
    if (total === 10) showAchievement('🏆 Cacciatore: 10 locali!');
  } catch {}
}

function showAchievement(msg) {
  const existing = document.querySelector('.achievement-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function trackCity(city) {
  if (!city) return;
  try {
    const cities = JSON.parse(localStorage.getItem('stasera_cities') || '{}');
    cities[city] = (cities[city] || 0) + 1;
    const sorted = Object.entries(cities).sort((a, b) => b[1] - a[1]).slice(0, 20);
    localStorage.setItem('stasera_cities', JSON.stringify(Object.fromEntries(sorted)));
  } catch {}
}

function getTrending() {
  try {
    const clicks = JSON.parse(localStorage.getItem('stasera_clicks') || '{}');
    return Object.entries(clicks).sort((a, b) => b[1] - a[1]).slice(0, 3);
  } catch { return []; }
}

// ===== Notify =====
function checkNewEvents(cityName, events) {
  try {
    const seen = JSON.parse(localStorage.getItem('stasera_seen_events') || '[]');
    const newEv = events.filter(e => !seen.includes(e.id) && e.city?.toLowerCase().includes(cityName?.toLowerCase()));
    if (newEv.length > 0) {
      return newEv;
    }
  } catch { return []; }
  return [];
}

function markEventsSeen(events) {
  try {
    const seen = JSON.parse(localStorage.getItem('stasera_seen_events') || '[]');
    events.forEach(e => { if (!seen.includes(e.id)) seen.push(e.id); });
    localStorage.setItem('stasera_seen_events', JSON.stringify(seen.slice(-200)));
  } catch {}
}
let radiusDebounce;
S('radius-slider')?.addEventListener('input', (e) => {
  setText('radius-value', `${e.target.value} km`);
  clearTimeout(radiusDebounce);
  radiusDebounce = setTimeout(() => { if (typeof userLocation !== 'undefined' && userLocation) drawRadiusCircle(userLocation, parseInt(e.target.value)); }, 100);
});
S('time-slider')?.addEventListener('input', (e) => {
  setText('time-value', `${e.target.value} min`);
});

function getFilters() {
  return {
    radius: parseInt(S('radius-slider')?.value || 10),
    modes: selectedModes,
    types: selectedTypes.length > 0 ? selectedTypes : ['nightclub','bar','pub','cinema','theatre','restaurant'],
    maxTime: parseInt(S('time-slider')?.value || 60),
    openNow: openNowActive,
    weekend: weekendActive,
  };
}

function showLoading() {
  S('loading')?.classList.remove('hidden');
  // Safety: hide after 20s even if something goes wrong
  clearTimeout(window._loadingTimeout);
  window._loadingTimeout = setTimeout(() => { hideLoading(); }, 20000);
}
function hideLoading() {
  clearTimeout(window._loadingTimeout);
  hideEl('loading');
}

// Advanced filter toggle (mobile)
S('advanced-toggle')?.addEventListener('click', function() {
  const adv = S('filter-advanced');
  if (!adv) return;
  adv.classList.toggle('collapsed');
  this.textContent = adv.classList.contains('collapsed') ? '⚙️ Distanza e mezzi ▸' : '⚙️ Distanza e mezzi ▾';
});

function renderVenueList(venues, routes, onClick, events) {
  const list = S('venue-list');
  const header = S('results-header');
  const count = S('results-count');
  if (!list) return;
  currentRoutes = routes;

  hideLoading();

  // Apply filters
  let filtered = getFilteredVenues(venues);
  currentVenues = filtered;

  if (count) count.textContent = `${filtered.length} locali trovati`;
  if (header) header.classList.remove('hidden');

  const frag = document.createDocumentFragment();

  if (events && events.length > 0 && !favoritesActive) {
    const eventSection = document.createElement('div');
    eventSection.className = 'events-section';
    const headerDiv = document.createElement('div');
    headerDiv.className = 'events-header collapsible-header';
    headerDiv.innerHTML = '<span>🎟️ Eventi in zona</span><span class="collapse-arrow">▾</span>';
    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'events-body';
    headerDiv.addEventListener('click', () => {
      bodyDiv.classList.toggle('collapsed');
      headerDiv.querySelector('.collapse-arrow').textContent = bodyDiv.classList.contains('collapsed') ? '▸' : '▾';
    });
    events.forEach(ev => {
      const card = document.createElement('div');
      card.className = 'event-card';
      card.innerHTML = `<div class="venue-icon">🎟️</div><div class="venue-info"><div class="venue-name">${ev.name}</div><div class="venue-meta"><span>📅 ${ev.date || 'TBA'}</span><span>📍 ${ev.venue}${ev.city ? ', ' + ev.city : ''}</span></div></div>${ev.url ? `<button class="venue-go-btn" data-url="${ev.url}" title="Biglietti">🎫 Biglietti</button>` : ''}`;
      card.addEventListener('click', (e) => { if (e.target.classList.contains('venue-go-btn')) { e.stopPropagation(); window.open(e.target.dataset.url, '_blank'); } });
      bodyDiv.appendChild(card);
    });
    eventSection.appendChild(headerDiv);
    eventSection.appendChild(bodyDiv);
    frag.appendChild(eventSection);
  }

  if (filtered.length === 0 && (!events || events.length === 0)) {
    list.innerHTML = '<div class="loading">Nessun locale trovato. Prova ad aumentare il raggio.</div>';
    return;
  }

  filtered.forEach(venue => {
    const r = routes[venue.id];
    const bestTime = r ? Math.min(...Object.values(r).filter(Boolean).map(x => x.duration)) : null;
    const isFav = isFavorite(venue.id);
    const smartTags = getSmartTags(venue);

    const card = document.createElement('div');
    card.className = 'venue-card';
    card.innerHTML = `
      <div class="venue-icon">${venue.icon}</div>
      <div class="venue-info">
        <div class="venue-name">${venue.name}</div>
        <div class="venue-meta">
          <span>${venue.label}</span>
          ${r ? Object.entries({walking:'🚶',cycling:'🚲',transit:'🚌',driving:'🚗'}).filter(([m]) => r[m]?.duration).map(([m,e]) => `<span>${e} ${r[m].duration}min</span>`).join('') : ''}
        </div>
        <div class="venue-tags">
          ${bestTime ? `<span class="venue-tag">⏱ ${bestTime} min</span>` : ''}
          ${r ? `<span class="venue-tag">📏 ${Object.values(r).find(x => x)?.distance || '—'} km</span>` : ''}
          ${smartTags.map(st => `<span class="venue-tag smart-tag">${st.e} ${st.l}</span>`).join('')}
        </div>
      </div>
      <div class="venue-actions">
        <button class="fav-btn${isFav ? ' active' : ''}" data-id="${venue.id}" title="Preferito">${isFav ? '⭐' : '☆'}</button>
        ${venue.website ? `<button class="venue-go-btn" data-url="${venue.website}" title="Vai al sito">🌐</button>` : ''}
      </div>
    `;

    card.addEventListener('click', (e) => {
      const t = e.target;
      if (t.classList.contains('venue-go-btn')) { e.stopPropagation(); window.open(t.dataset.url, '_blank'); return; }
      if (t.classList.contains('fav-btn')) {
        e.stopPropagation();
        toggleFavorite(venue);
        const favs = getFavorites();
        t.classList.toggle('active', favs.some(f => f.id === venue.id));
        t.textContent = favs.some(f => f.id === venue.id) ? '⭐' : '☆';
        return;
      }
      trackClick(venue);
      onClick(venue);
      document.querySelectorAll('.venue-card.active').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });

    frag.appendChild(card);
  });

  if (favoritesActive && filtered.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'loading';
    msg.textContent = '⭐ Nessun preferito salvato. Clicca ☆ su un locale per aggiungerlo.';
    frag.appendChild(msg);
  }

  list.innerHTML = '';
  list.appendChild(frag);
  if (list.dataset.scrollTop) { requestAnimationFrame(() => { list.scrollTop = parseInt(list.dataset.scrollTop); delete list.dataset.scrollTop; }); }
}

function showVenueDetail(venue, routes) {
  const detail = S('venue-detail');
  const content = S('detail-content');
  if (!detail || !content) return;
  detail.classList.remove('hidden');

  const r = routes[venue.id] || {};
  const routeLabels = { walking: '🚶 A piedi', cycling: '🚲 In bici', transit: '🚌 Mezzi', driving: '🚗 In auto' };
  const routesHtml = Object.entries(r).filter(([,v]) => v).map(([mode,v]) => `<div class="detail-route">${routeLabels[mode]||mode}<br><span class="time">${v.duration} min</span> · ${v.distance} km</div>`).join('') || '<div style="font-size:13px;color:var(--text-secondary)">Calcolo percorso...</div>';

  // Lazy description
  if (!venue.description && venue.tags) {
    venue.description = describeVenue(venue, venue.tags);
  }
  const desc = venue.description;

  const allEvents = window._events || [];
  const venueEvents = allEvents.filter(ev => {
    // Must have event coordinates and be within 500m of venue
    if (ev.lat == null || ev.lng == null || venue.lat == null || venue.lng == null) return false;
    const dist = haversineKm(
      { lat: ev.lat, lng: ev.lng },
      { lat: venue.lat, lng: venue.lng }
    );
    return dist < 0.5;
  });

  const eventsHtml = venueEvents.length > 0 ? `<div class="detail-events"><h3>🎟️ Prossime serate</h3>${venueEvents.map(ev => `<div class="detail-event-item">${ev.image ? `<img src="${ev.image}" class="detail-event-img" alt="${ev.name}" loading="lazy">` : ''}<div class="detail-event-info"><div class="detail-event-name">${ev.name}</div><div class="detail-event-meta">📅 ${ev.date||'TBA'}${ev.time ? ' · 🕐 '+ev.time : ''}</div></div>${ev.priceMin ? `<div class="detail-event-price">da ${ev.priceMin}€</div>` : ''}${ev.url ? `<button class="detail-event-btn" onclick="window.open('${ev.url}','_blank')">Biglietti</button>` : ''}</div>`).join('')}</div>` : '';

  const shareText = encodeURIComponent(`Stasera vado al ${venue.name} (${venue.label}) — ${venue.address}\nScoperto con Cosa facciamo stasera?\n`);
  const shareUrl = encodeURIComponent(window.location.href);
  const isFav = isFavorite(venue.id);
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(venue.name)}+${encodeURIComponent(typeof userLocation !== 'undefined' && userLocation ? userLocation.city || '' : '')}`;
  const openLabel = isOpenNow(venue.openingHours) ? ' 🟢 Aperto ora' : '';

  content.innerHTML = `
    <h2 id="detail-name">${venue.icon} ${venue.name}${venue.rating ? `<span style="font-size:14px;color:#f5a623;"> ★${venue.rating}</span>` : ''}${openLabel}</h2>
    <div id="detail-address">📍 ${venue.address}</div>
    <div class="detail-routes">${routesHtml}</div>
    <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
      <a href="https://wa.me/?text=${shareText}%20${shareUrl}" target="_blank" class="detail-share-btn">📱 WhatsApp</a>
      <a href="https://t.me/share/url?url=${shareUrl}&text=${shareText}" target="_blank" class="detail-share-btn">✈️ Telegram</a>
      <button class="detail-share-btn" onclick="navigator.clipboard.writeText(decodeURIComponent('${shareText}').split('%20').join(' ')+' '+window.location.href);this.textContent='✅ Copiato!';setTimeout(()=>this.textContent='📋 Copia',2000)">📋 Copia</button>
      <button class="detail-share-btn fav-detail-btn${isFav?' active':''}" id="fav-detail-btn">${isFav?'⭐':'☆'} Preferito</button>
    </div>
    ${desc ? `<div style="margin-top:14px;padding:12px 14px;background:var(--bg-secondary);border-radius:12px;font-size:13px;line-height:1.6;color:var(--text);"><div style="font-weight:600;margin-bottom:4px;">📝 Il locale</div>${desc.description}</div>${(desc.pros.length||desc.cons.length) ? `<div style="display:flex;gap:12px;margin-top:10px;flex-wrap:wrap;">${desc.pros.length ? `<div style="flex:1;min-width:180px;padding:10px 14px;background:#e8f5e9;border-radius:12px;font-size:12px;"><div style="font-weight:600;color:#2e7d32;margin-bottom:4px;">✅ Pro</div>${desc.pros.map(p => `<div style="color:#388e3c;line-height:1.5;">• ${p}</div>`).join('')}</div>` : ''}${desc.cons.length ? `<div style="flex:1;min-width:180px;padding:10px 14px;background:#fce4e4;border-radius:12px;font-size:12px;"><div style="font-weight:600;color:#c62828;margin-bottom:4px;">❌ Contro</div>${desc.cons.map(c => `<div style="color:#d32f2f;line-height:1.5;">• ${c}</div>`).join('')}</div>` : ''}</div>` : ''}` : ''}
    ${venue.website ? `<a class="detail-website" href="${venue.website.startsWith('http') ? venue.website : 'https://' + venue.website}" target="_blank">🌐 Vai al sito del locale</a>` : `<a class="detail-website" href="${googleSearchUrl}" target="_blank">🔍 Cerca su Google</a>`}
    ${venue.phone ? `<div style="margin-top:10px;font-size:13px;color:var(--text-secondary)">📞 ${venue.phone}</div>` : ''}
    ${venue.openingHours ? `<div style="margin-top:4px;font-size:13px;color:var(--text-secondary)">🕐 ${venue.openingHours}</div>` : ''}
    ${eventsHtml}
  `;

  S('fav-detail-btn')?.addEventListener('click', () => {
    toggleFavorite(venue);
    const btn = S('fav-detail-btn');
    const fav = isFavorite(venue.id);
    if (btn) { btn.classList.toggle('active', fav); btn.textContent = fav ? '⭐ Preferito' : '☆ Preferito'; }
    if (window._lastVenues) sortAndRender(window._lastVenues, window._venueRoutes || {});
  });
}

function hideVenueDetail() {
  S('venue-detail')?.classList.add('hidden');
  document.querySelectorAll('.venue-card.active').forEach(c => c.classList.remove('active'));
}

function clearResults() {
  const vl = S('venue-list'); if (vl) vl.innerHTML = '';
  S('results-header')?.classList.add('hidden');
  S('venue-detail')?.classList.add('hidden');
}

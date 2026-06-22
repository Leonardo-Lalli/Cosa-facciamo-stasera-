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
  document.getElementById('chip-opennow').classList.toggle('active', openNowActive);
  document.getElementById('chip-weekend').classList.toggle('active', weekendActive);
  document.getElementById('chip-favorites').classList.toggle('active', favoritesActive);
  if (favoritesActive) {
    document.querySelectorAll('#type-filters .chip.active').forEach(c => c.classList.remove('active'));
    selectedTypes = [];
  }
}

document.getElementById('chip-opennow').addEventListener('click', () => {
  openNowActive = !openNowActive;
  if (openNowActive) { weekendActive = false; favoritesActive = false; }
  updateSpecialChips();
  if (window._lastVenues) {
    window._lastVenues = window._allVenues || window._lastVenues;
    sortAndRender(window._lastVenues, window._venueRoutes || {});
  }
});

document.getElementById('chip-weekend').addEventListener('click', () => {
  weekendActive = !weekendActive;
  if (weekendActive) { openNowActive = false; favoritesActive = false; }
  updateSpecialChips();
  if (window._lastVenues) {
    window._lastVenues = window._allVenues || window._lastVenues;
    sortAndRender(window._lastVenues, window._venueRoutes || {});
  }
});

document.getElementById('chip-favorites').addEventListener('click', () => {
  favoritesActive = !favoritesActive;
  if (favoritesActive) { openNowActive = false; weekendActive = false; }
  updateSpecialChips();
  if (window._allVenues) {
    window._lastVenues = window._allVenues;
    sortAndRender(window._allVenues, window._venueRoutes || {});
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

// Sliders
let radiusDebounce;
document.getElementById('radius-slider').addEventListener('input', (e) => {
  document.getElementById('radius-value').textContent = `${e.target.value} km`;
  clearTimeout(radiusDebounce);
  radiusDebounce = setTimeout(() => { if (typeof userLocation !== 'undefined' && userLocation) drawRadiusCircle(userLocation, parseInt(e.target.value)); }, 100);
});
document.getElementById('time-slider').addEventListener('input', (e) => {
  document.getElementById('time-value').textContent = `${e.target.value} min`;
});

function getFilters() {
  return {
    radius: parseInt(document.getElementById('radius-slider').value),
    modes: selectedModes,
    types: selectedTypes.length > 0 ? selectedTypes : ['nightclub','bar','pub','cinema','theatre','restaurant'],
    maxTime: parseInt(document.getElementById('time-slider').value),
    openNow: openNowActive,
    weekend: weekendActive,
  };
}

function showLoading() { document.getElementById('loading').classList.remove('hidden'); }
function hideLoading() { document.getElementById('loading').classList.add('hidden'); }

function renderVenueList(venues, routes, onClick, events) {
  const list = document.getElementById('venue-list');
  const header = document.getElementById('results-header');
  const count = document.getElementById('results-count');
  currentRoutes = routes;

  hideLoading();

  // Apply filters
  let filtered = getFilteredVenues(venues);
  currentVenues = filtered;

  count.textContent = `${filtered.length} locali trovati`;
  header.classList.remove('hidden');

  const frag = document.createDocumentFragment();

  if (events && events.length > 0 && !favoritesActive) {
    const eventSection = document.createElement('div');
    eventSection.className = 'events-section';
    eventSection.innerHTML = '<div class="events-header">🎟️ Eventi in zona</div>';
    events.forEach(ev => {
      const card = document.createElement('div');
      card.className = 'event-card';
      card.innerHTML = `<div class="venue-icon">🎟️</div><div class="venue-info"><div class="venue-name">${ev.name}</div><div class="venue-meta"><span>📅 ${ev.date || 'TBA'}</span><span>📍 ${ev.venue}${ev.city ? ', ' + ev.city : ''}</span></div></div>${ev.url ? `<button class="venue-go-btn" data-url="${ev.url}" title="Biglietti">🎫 Biglietti</button>` : ''}`;
      card.addEventListener('click', (e) => { if (e.target.classList.contains('venue-go-btn')) { e.stopPropagation(); window.open(e.target.dataset.url, '_blank'); } });
      eventSection.appendChild(card);
    });
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

    const card = document.createElement('div');
    card.className = 'venue-card';
    card.innerHTML = `
      <div class="venue-icon">${venue.icon}</div>
      <div class="venue-info">
        <div class="venue-name">${venue.name}</div>
        <div class="venue-meta">
          <span>${venue.label}</span>
          ${r ? `<span>🚶 ${r.walking?.duration || '—'}min</span>` : ''}
          ${r ? `<span>🚗 ${r.driving?.duration || '—'}min</span>` : ''}
        </div>
        <div class="venue-tags">
          ${bestTime ? `<span class="venue-tag">⏱ ${bestTime} min</span>` : ''}
          ${r ? `<span class="venue-tag">📏 ${Object.values(r).find(x => x)?.distance || '—'} km</span>` : ''}
          ${isOpenNow(venue.openingHours) ? '<span class="venue-tag open-tag">🟢 Aperto</span>' : ''}
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
  const detail = document.getElementById('venue-detail');
  const content = document.getElementById('detail-content');
  detail.classList.remove('hidden');

  const r = routes[venue.id] || {};
  const routeLabels = { walking: '🚶 A piedi', cycling: '🚲 In bici', driving: '🚗 In auto' };
  const routesHtml = Object.entries(r).filter(([,v]) => v).map(([mode,v]) => `<div class="detail-route">${routeLabels[mode]||mode}<br><span class="time">${v.duration} min</span> · ${v.distance} km</div>`).join('') || '<div style="font-size:13px;color:var(--text-secondary)">Calcolo percorso...</div>';

  const allEvents = window._events || [];
  const venueEvents = allEvents.filter(ev => {
    const vn = (ev.venue || '').toLowerCase(), nn = venue.name.toLowerCase();
    return vn.includes(nn) || nn.includes(vn) || (vn && nn && vn.split(' ').some(w => nn.includes(w)));
  });

  const eventsHtml = venueEvents.length > 0 ? `<div class="detail-events"><h3>🎟️ Prossime serate</h3>${venueEvents.map(ev => `<div class="detail-event-item">${ev.image ? `<img src="${ev.image}" class="detail-event-img" alt="${ev.name}" loading="lazy">` : ''}<div class="detail-event-info"><div class="detail-event-name">${ev.name}</div><div class="detail-event-meta">📅 ${ev.date||'TBA'}${ev.time ? ' · 🕐 '+ev.time : ''}</div></div>${ev.priceMin ? `<div class="detail-event-price">da ${ev.priceMin}€</div>` : ''}${ev.url ? `<button class="detail-event-btn" onclick="window.open('${ev.url}','_blank')">Biglietti</button>` : ''}</div>`).join('')}</div>` : '';

  const shareText = encodeURIComponent(`Stasera vado al ${venue.name} (${venue.label}) — ${venue.address}\nScoperto con Cosa facciamo stasera?\n`);
  const shareUrl = encodeURIComponent(window.location.href);
  const isFav = isFavorite(venue.id);
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(venue.name)}+${encodeURIComponent(window.userLocation?.city || '')}`;
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
    ${venue.description ? `<div style="margin-top:14px;padding:12px 14px;background:var(--bg-secondary);border-radius:12px;font-size:13px;line-height:1.6;color:var(--text);"><div style="font-weight:600;margin-bottom:4px;">📝 Il locale</div>${venue.description.description}</div>${(venue.description.pros.length||venue.description.cons.length) ? `<div style="display:flex;gap:12px;margin-top:10px;flex-wrap:wrap;">${venue.description.pros.length ? `<div style="flex:1;min-width:180px;padding:10px 14px;background:#e8f5e9;border-radius:12px;font-size:12px;"><div style="font-weight:600;color:#2e7d32;margin-bottom:4px;">✅ Pro</div>${venue.description.pros.map(p => `<div style="color:#388e3c;line-height:1.5;">• ${p}</div>`).join('')}</div>` : ''}${venue.description.cons.length ? `<div style="flex:1;min-width:180px;padding:10px 14px;background:#fce4e4;border-radius:12px;font-size:12px;"><div style="font-weight:600;color:#c62828;margin-bottom:4px;">❌ Contro</div>${venue.description.cons.map(c => `<div style="color:#d32f2f;line-height:1.5;">• ${c}</div>`).join('')}</div>` : ''}</div>` : ''}` : ''}
    ${venue.website ? `<a class="detail-website" href="${venue.website.startsWith('http') ? venue.website : 'https://' + venue.website}" target="_blank">🌐 Vai al sito del locale</a>` : `<a class="detail-website" href="${googleSearchUrl}" target="_blank">🔍 Cerca su Google</a>`}
    ${venue.phone ? `<div style="margin-top:10px;font-size:13px;color:var(--text-secondary)">📞 ${venue.phone}</div>` : ''}
    ${venue.openingHours ? `<div style="margin-top:4px;font-size:13px;color:var(--text-secondary)">🕐 ${venue.openingHours}</div>` : ''}
    ${eventsHtml}
  `;

  document.getElementById('fav-detail-btn').addEventListener('click', () => {
    toggleFavorite(venue);
    const btn = document.getElementById('fav-detail-btn');
    const fav = isFavorite(venue.id);
    btn.classList.toggle('active', fav);
    btn.textContent = fav ? '⭐ Preferito' : '☆ Preferito';
    if (window._lastVenues) sortAndRender(window._lastVenues, window._venueRoutes || {});
  });
}

function hideVenueDetail() {
  document.getElementById('venue-detail').classList.add('hidden');
  document.querySelectorAll('.venue-card.active').forEach(c => c.classList.remove('active'));
}

function clearResults() {
  document.getElementById('venue-list').innerHTML = '';
  document.getElementById('results-header').classList.add('hidden');
  document.getElementById('venue-detail').classList.add('hidden');
}

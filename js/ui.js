// ===== UI Module =====
let selectedModes = ['walking'];
let selectedTypes = ['nightclub', 'bar', 'pub', 'cinema', 'theatre', 'restaurant'];
let currentVenues = [];
let currentRoutes = {};

// Transport mode buttons
document.querySelectorAll('.transport-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
    selectedModes = Array.from(document.querySelectorAll('.transport-btn.active'))
      .map(b => b.dataset.mode);
  });
});

// Type chips
const VERB_MAP = {
  cinema: 'guardiamo', restaurant: 'mangiamo', nightclub: 'balliamo',
  bar: 'beviamo', pub: 'beviamo', theatre: 'vediamo',
  live_music: 'ascoltiamo', bowling: 'giochiamo', dance_hall: 'balliamo',
  casino: 'giochiamo', arcade: 'giochiamo', karaoke: 'cantiamo',
  events_venue: 'festeggiamo',
};

let typewriterLock = false;

function animateVerb(newVerb) {
  const el = document.getElementById('verb');
  if (!el) return;
  if (typewriterLock) return;
  typewriterLock = true;

  const current = el.textContent;
  if (current === newVerb) { typewriterLock = false; return; }

  el.classList.add('typing');

  let i = current.length;
  const erase = setInterval(() => {
    if (i <= 0) {
      clearInterval(erase);
      let j = 0;
      const write = setInterval(() => {
        if (j <= newVerb.length) {
          el.textContent = newVerb.slice(0, j);
          j++;
        } else {
          clearInterval(write);
          el.classList.remove('typing');
          typewriterLock = false;
        }
      }, 40);
      return;
    }
    el.textContent = current.slice(0, i - 1);
    i--;
  }, 30);
}

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    chip.classList.toggle('active');
    selectedTypes = Array.from(document.querySelectorAll('.chip.active'))
      .map(c => c.dataset.type);

    // Animate logo verb
    if (selectedTypes.length === 1) {
      animateVerb(VERB_MAP[selectedTypes[0]] || 'facciamo');
    } else {
      animateVerb('facciamo');
    }
  });
});

// Radius slider
document.getElementById('radius-slider').addEventListener('input', (e) => {
  document.getElementById('radius-value').textContent = `${e.target.value} km`;
  if (userLocation) drawRadiusCircle(userLocation, parseInt(e.target.value));
});

// Time slider
document.getElementById('time-slider').addEventListener('input', (e) => {
  document.getElementById('time-value').textContent = `${e.target.value} min`;
});

function getFilters() {
  return {
    radius: parseInt(document.getElementById('radius-slider').value),
    modes: selectedModes,
    types: selectedTypes,
    maxTime: parseInt(document.getElementById('time-slider').value),
  };
}

function showLoading() {
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('venue-list').innerHTML = '';
}

function hideLoading() {
  document.getElementById('loading').classList.add('hidden');
}

function renderVenueList(venues, routes, onClick, events) {
  const list = document.getElementById('venue-list');
  const header = document.getElementById('results-header');
  const count = document.getElementById('results-count');
  currentVenues = venues;
  currentRoutes = routes;

  hideLoading();
  count.textContent = `${venues.length} locali trovati`;
  header.classList.remove('hidden');
  list.innerHTML = '';

  // Show events first
  if (events && events.length > 0) {
    const eventSection = document.createElement('div');
    eventSection.className = 'events-section';
    eventSection.innerHTML = '<div class="events-header">🎟️ Eventi in zona</div>';

    events.forEach(ev => {
      const card = document.createElement('div');
      card.className = 'event-card';
      card.innerHTML = `
        <div class="venue-icon">🎟️</div>
        <div class="venue-info">
          <div class="venue-name">${ev.name}</div>
          <div class="venue-meta">
            <span>📅 ${ev.date || 'Data da definirsi'}</span>
            <span>📍 ${ev.venue}${ev.city ? ', ' + ev.city : ''}</span>
          </div>
        </div>
        ${ev.url ? `<button class="venue-go-btn" data-url="${ev.url}" title="Biglietti">🎫 Biglietti</button>` : ''}
      `;
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('venue-go-btn')) {
          e.stopPropagation();
          window.open(e.target.dataset.url, '_blank');
        }
      });
      eventSection.appendChild(card);
    });

    list.appendChild(eventSection);
  }

  if (venues.length === 0 && (!events || events.length === 0)) {
    list.innerHTML = '<div class="loading">Nessun locale trovato. Prova ad aumentare il raggio.</div>';
    return;
  }

  venues.forEach(venue => {
    const r = routes[venue.id];
    const bestTime = r ? Math.min(...Object.values(r).filter(Boolean).map(x => x.duration)) : null;

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
        </div>
      </div>
      ${venue.website ? `<button class="venue-go-btn" data-url="${venue.website}" title="Vai al sito">🌐 Sito</button>` : ''}
    `;

    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('venue-go-btn')) {
        e.stopPropagation();
        window.open(e.target.dataset.url, '_blank');
        return;
      }
      onClick(venue);
      // Highlight
      document.querySelectorAll('.venue-card.active').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });

    list.appendChild(card);
  });
}

function showVenueDetail(venue, routes) {
  const detail = document.getElementById('venue-detail');
  const content = document.getElementById('detail-content');
  detail.classList.remove('hidden');

  const r = routes[venue.id] || {};
  const routeLabels = { walking: '🚶 A piedi', cycling: '🚲 In bici', driving: '🚗 In auto' };

  const routesHtml = Object.entries(r)
    .filter(([, v]) => v)
    .map(([mode, v]) => `
      <div class="detail-route">
        ${routeLabels[mode] || mode}<br>
        <span class="time">${v.duration} min</span> · ${v.distance} km
      </div>
    `).join('') || '<div style="font-size:13px;color:var(--text-secondary)">Calcolo percorso...</div>';

  // Find matching events
  const allEvents = window._events || [];
  const venueEvents = allEvents.filter(ev => {
    const vn = (ev.venue || '').toLowerCase();
    const nn = venue.name.toLowerCase();
    return vn.includes(nn) || nn.includes(vn) || (vn && nn && vn.split(' ').some(w => nn.includes(w)));
  });

  const eventsHtml = venueEvents.length > 0 ? `
    <div class="detail-events">
      <h3>🎟️ Prossime serate</h3>
      ${venueEvents.map(ev => `
        <div class="detail-event-item">
          <div class="detail-event-info">
            <div class="detail-event-name">${ev.name}</div>
            <div class="detail-event-meta">📅 ${ev.date || 'TBA'}${ev.time ? ' · 🕐 ' + ev.time : ''}</div>
          </div>
          ${ev.priceMin ? `<div class="detail-event-price">da ${ev.priceMin}€</div>` : ''}
          ${ev.url ? `<button class="detail-event-btn" onclick="window.open('${ev.url}','_blank')">Biglietti</button>` : ''}
        </div>
      `).join('')}
    </div>
  ` : '';

  content.innerHTML = `
    <h2 id="detail-name">${venue.icon} ${venue.name}${venue.rating ? `<span style="font-size:14px;color:#f5a623;"> ★${venue.rating}</span>` : ''}</h2>
    <div id="detail-address">📍 ${venue.address}</div>
    <div class="detail-routes">${routesHtml}</div>

    ${venue.description ? `
    <div style="margin-top:14px;padding:12px 14px;background:var(--bg-secondary);border-radius:12px;font-size:13px;line-height:1.6;color:var(--text);">
      <div style="font-weight:600;margin-bottom:4px;">📝 Il locale</div>
      ${venue.description.description}
    </div>
    ${(venue.description.pros.length || venue.description.cons.length) ? `
    <div style="display:flex;gap:12px;margin-top:10px;flex-wrap:wrap;">
      ${venue.description.pros.length ? `
      <div style="flex:1;min-width:180px;padding:10px 14px;background:#e8f5e9;border-radius:12px;font-size:12px;">
        <div style="font-weight:600;color:#2e7d32;margin-bottom:4px;">✅ Pro</div>
        ${venue.description.pros.map(p => `<div style="color:#388e3c;line-height:1.5;">• ${p}</div>`).join('')}
      </div>` : ''}
      ${venue.description.cons.length ? `
      <div style="flex:1;min-width:180px;padding:10px 14px;background:#fce4e4;border-radius:12px;font-size:12px;">
        <div style="font-weight:600;color:#c62828;margin-bottom:4px;">❌ Contro</div>
        ${venue.description.cons.map(c => `<div style="color:#d32f2f;line-height:1.5;">• ${c}</div>`).join('')}
      </div>` : ''}
    </div>` : ''}
    ` : ''}

    ${venue.website ? `<a class="detail-website" href="${venue.website.startsWith('http') ? venue.website : 'https://' + venue.website}" target="_blank">🌐 Vai al sito del locale</a>` : ''}
    ${venue.phone ? `<div style="margin-top:10px;font-size:13px;color:var(--text-secondary)">📞 ${venue.phone}</div>` : ''}
    ${venue.openingHours ? `<div style="margin-top:4px;font-size:13px;color:var(--text-secondary)">🕐 ${venue.openingHours}</div>` : ''}
    ${eventsHtml}
  `;
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

// ===== Leaflet Map =====
let map;
let tileLayer;
let userMarker;
let venueMarkers = [];
let venueMarkerMap = {};
let userLocation = null;

const DEFAULT_CENTER = [41.9028, 12.4964];
const DEFAULT_ZOOM = 13;

const TILE_URLS = {
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};

const MARKER_HTML = (icon, active) => `<div style="
  width:${active ? '42' : '36'}px;height:${active ? '42' : '36'}px;
  background:${active ? '#1a73e8' : 'white'};
  border:${active ? '3px solid white' : '2px solid #1a73e8'};
  border-radius:${active ? '12px' : '8px'};
  display:flex;align-items:center;justify-content:center;
  font-size:${active ? '22' : '18'}px;
  box-shadow:0 2px 8px rgba(0,0,0,0.2);
  cursor:pointer;
  transition:all 0.15s;
">${icon}</div>`;

function initMap() {
  map = L.map('map').setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  tileLayer = L.tileLayer(isDark ? TILE_URLS.dark : TILE_URLS.light, {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
  }).addTo(map);

  userMarker = L.marker(DEFAULT_CENTER, {
    icon: L.divIcon({
      className: 'user-marker',
      html: '<div style="width:20px;height:20px;background:#1a73e8;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    }),
  }).addTo(map).bindPopup('La tua posizione');
}

function switchMapTiles() {
  if (!tileLayer) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  tileLayer.setUrl(isDark ? TILE_URLS.dark : TILE_URLS.light);
}

function setUserLocation(lat, lng) {
  userLocation = { lat, lng };
  suppressNextExplore();
  userMarker.setLatLng([lat, lng]);
  map.setView([lat, lng], 14);
  lastExploreCenter = { lat, lng };
}

function drawRadiusCircle(center, radiusKm) {
  map.eachLayer(layer => {
    if (layer._radiusCircle) map.removeLayer(layer);
  });
  const circle = L.circle([center.lat, center.lng], {
    radius: radiusKm * 1000,
    color: '#1a73e8',
    fillColor: '#1a73e8',
    fillOpacity: 0.08,
    weight: 2,
    dashArray: '8 4',
  }).addTo(map);
  circle._radiusCircle = true;
}

function clearVenueMarkers() {
  venueMarkers.forEach(m => map.removeLayer(m));
  venueMarkers = [];
  venueMarkerMap = {};
}

function addVenueMarkers(venues, onClick) {
  clearVenueMarkers();

  venues.forEach(venue => {
    const icon = L.divIcon({
      className: 'venue-marker',
      html: MARKER_HTML(venue.icon, false),
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const marker = L.marker([venue.lat, venue.lng], { icon }).addTo(map);
    marker.bindPopup(`<b>${sanitize(venue.name)}</b><br>${sanitize(venue.address)}`);
    marker.on('click', () => onClick(venue));

    venueMarkers.push(marker);
    venueMarkerMap[venue.id] = marker;
  });
}

function highlightMarker(venueId) {
  Object.values(venueMarkerMap).forEach(m => {
    const div = m.getElement();
    if (div) {
      const inner = div.querySelector('div');
      if (inner) inner.outerHTML = MARKER_HTML(venueMarkers.find(vm => venueMarkerMap[vm] === m)?.icon || '📍', false);
      div.style.zIndex = '';
    }
  });

  const marker = venueMarkerMap[venueId];
  if (!marker) return;

  const div = marker.getElement();
  if (div) {
    const inner = div.querySelector('div');
    if (inner) {
      const venue = Object.entries(venueMarkerMap).find(([, m]) => m === marker);
      const icon = venue ? venueMarkers.find(v => venueMarkerMap[v.id] === marker)?.icon || '📍' : '📍';
      inner.outerHTML = MARKER_HTML(icon, true);
    }
    div.style.zIndex = '1000';
  }

  marker.openPopup();
  map.panTo(marker.getLatLng(), { animate: true, duration: 0.3 });
}

function fitBounds(venues) {
  if (venues.length === 0) return;
  const bounds = L.latLngBounds(venues.map(v => [v.lat, v.lng]));
  if (userLocation) bounds.extend([userLocation.lat, userLocation.lng]);
  map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
}

// Explore zone: auto-search on map move
let exploreTimeout;
let lastExploreCenter = null;
let suppressExploreCount = 0;

function suppressNextExplore() { suppressExploreCount++; }

function enableExploreMode() {
  map.on('moveend', () => {
    if (suppressExploreCount > 0) { suppressExploreCount--; return; }
    clearTimeout(exploreTimeout);
    exploreTimeout = setTimeout(() => {
      if (suppressExploreCount > 0 || !userLocation) return;
      const c = map.getCenter();
      const dist = lastExploreCenter ? haversineKm(
        { lat: lastExploreCenter.lat, lng: lastExploreCenter.lng },
        { lat: c.lat, lng: c.lng }
      ) : 999;
      if (dist < 0.5) return;
      lastExploreCenter = { lat: c.lat, lng: c.lng };
      userLocation = { lat: c.lat, lng: c.lng, city: userLocation.city || '', display: userLocation.display || '' };
      document.getElementById('location-input').value = `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`;
      if (typeof performSearch === 'function' && !(typeof searchInProgress !== 'undefined' && searchInProgress)) performSearch();
    }, 800);
  });
}

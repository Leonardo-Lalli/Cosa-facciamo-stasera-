// ===== Leaflet Map =====
let map;
let userMarker;
let venueMarkers = [];
let userLocation = null;

// Default: Rome, Italy
const DEFAULT_CENTER = [41.9028, 12.4964];
const DEFAULT_ZOOM = 13;

function initMap() {
  map = L.map('map').setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
  }).addTo(map);

  // User marker
  userMarker = L.marker(DEFAULT_CENTER, {
    icon: L.divIcon({
      className: 'user-marker',
      html: '<div style="width:20px;height:20px;background:#1a73e8;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    }),
  }).addTo(map).bindPopup('La tua posizione');
}

function setUserLocation(lat, lng) {
  userLocation = { lat, lng };
  userMarker.setLatLng([lat, lng]);
  map.setView([lat, lng], 14);
}

function drawRadiusCircle(center, radiusKm) {
  // Remove existing circle
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
}

function addVenueMarkers(venues, onClick) {
  clearVenueMarkers();

  venues.forEach(venue => {
    const marker = L.marker([venue.lat, venue.lng], {
      icon: L.divIcon({
        className: 'venue-marker',
        html: `<div style="
          width:36px;height:36px;
          background:white;
          border:2px solid #1a73e8;
          border-radius:8px;
          display:flex;align-items:center;justify-content:center;
          font-size:18px;
          box-shadow:0 2px 8px rgba(0,0,0,0.2);
          cursor:pointer;
        ">${venue.icon}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      }),
    }).addTo(map);

    marker.bindPopup(`<b>${venue.name}</b><br>${venue.address}`);
    marker.on('click', () => onClick(venue));

    venueMarkers.push(marker);
  });
}

function fitBounds(venues) {
  if (venues.length === 0) return;
  const bounds = L.latLngBounds(venues.map(v => [v.lat, v.lng]));
  if (userLocation) bounds.extend([userLocation.lat, userLocation.lng]);
  map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
}

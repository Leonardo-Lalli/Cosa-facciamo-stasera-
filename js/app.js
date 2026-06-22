// ===== Main App Controller =====

// Geocode address to coordinates using Nominatim (OpenStreetMap)
async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  const resp = await fetch(url, {
    headers: { 'Accept-Language': 'it' },
  });
  const data = await resp.json();
  if (data.length === 0) throw new Error('Luogo non trovato');
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
}

// Get user's current location via browser
function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalizzazione non supportata'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error('Impossibile ottenere la posizione'))
    );
  });
}

// Main search function
async function performSearch() {
  const filters = getFilters();

  if (filters.types.length === 0) {
    alert('Seleziona almeno un tipo di locale');
    return;
  }

  const locationInput = document.getElementById('location-input').value.trim();
  if (!locationInput && !userLocation) {
    alert('Inserisci una città o clicca 📍 per usare la tua posizione');
    return;
  }

  showLoading();
  clearVenueMarkers();
  hideVenueDetail();

  try {
    // Geocode if needed
    if (locationInput && (!userLocation || userLocation.display !== locationInput)) {
      const loc = await geocode(locationInput);
      userLocation = loc;
      setUserLocation(loc.lat, loc.lng);
      drawRadiusCircle(loc, filters.radius);
    } else if (userLocation) {
      drawRadiusCircle(userLocation, filters.radius);
    }

    // Fetch venues from Overpass
    const venues = await fetchVenues(userLocation, filters.radius, filters.types);

    // Calculate routes for all venues
    const routes = {};
    const validVenues = [];

    for (const venue of venues) {
      try {
        const r = await getRoutesForModes(
          { lat: userLocation.lat, lng: userLocation.lng },
          { lat: venue.lat, lng: venue.lng }
        );
        routes[venue.id] = r;

        // Filter by max time
        const bestTime = Math.min(...Object.values(r).filter(Boolean).map(x => x.duration));
        if (bestTime <= filters.maxTime) {
          validVenues.push(venue);
        }
      } catch {
        // If routing fails, still show the venue
        validVenues.push(venue);
        routes[venue.id] = {};
      }
    }

    // Sort
    document.getElementById('sort-select').addEventListener('change', () => sortAndRender(validVenues, routes));

    sortAndRender(validVenues, routes);
    addVenueMarkers(validVenues, (venue) => {
      showVenueDetail(venue, routes);
      highlightVenueCard(venue);
    });

    if (validVenues.length > 0) fitBounds(validVenues);

  } catch (err) {
    hideLoading();
    console.error(err);
    alert('Errore nella ricerca: ' + err.message);
  }
}

function sortAndRender(venues, routes) {
  const sortBy = document.getElementById('sort-select').value;
  const sorted = [...venues];

  if (sortBy === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === 'time') {
    sorted.sort((a, b) => {
      const ta = getBestTime(routes[a.id]);
      const tb = getBestTime(routes[b.id]);
      return ta - tb;
    });
  } else {
    sorted.sort((a, b) => {
      const da = getBestDist(routes[a.id]);
      const db = getBestDist(routes[b.id]);
      return da - db;
    });
  }

  renderVenueList(sorted, routes, (venue) => {
    showVenueDetail(venue, routes);
    highlightVenueCard(venue);
  });
}

function getBestTime(r) {
  if (!r) return Infinity;
  return Math.min(...Object.values(r).filter(Boolean).map(x => x.duration));
}

function getBestDist(r) {
  if (!r) return Infinity;
  return Math.min(...Object.values(r).filter(Boolean).map(x => parseFloat(x.distance)));
}

function highlightVenueCard(venue) {
  document.querySelectorAll('.venue-card.active').forEach(c => c.classList.remove('active'));
  const cards = document.querySelectorAll('.venue-card');
  cards.forEach(card => {
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

    // Reverse geocode to show city name
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.lat}&lon=${pos.lng}`;
      const resp = await fetch(url, { headers: { 'Accept-Language': 'it' } });
      const data = await resp.json();
      const city = data.address?.city || data.address?.town || data.address?.village || '';
      if (city) document.getElementById('location-input').value = city;
    } catch {}

    // Auto-search
    performSearch();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('location-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') performSearch();
});

document.getElementById('close-detail').addEventListener('click', hideVenueDetail);

// Init map on load
window.addEventListener('DOMContentLoaded', () => {
  initMap();
});

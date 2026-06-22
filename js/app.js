// ===== Main App Controller =====

async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  const resp = await fetch(url, { headers: { 'Accept-Language': 'it' } });
  const data = await resp.json();
  if (data.length === 0) throw new Error('Luogo non trovato');
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
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
    // Geocode
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

    if (venues.length === 0) {
      hideLoading();
      renderVenueList([], {}, () => {});
      clearVenueMarkers();
      return;
    }

    // Show venues immediately with estimated distances
    const estimatedRoutes = {};
    venues.forEach(v => {
      estimatedRoutes[v.id] = {
        walking: estimate({ lat: userLocation.lat, lng: userLocation.lng }, { lat: v.lat, lng: v.lng }, 'walking'),
      };
    });

    sortAndRender(venues, estimatedRoutes);
    addVenueMarkers(venues, venue => {
      const routes = window._venueRoutes || estimatedRoutes;
      showVenueDetail(venue, routes);
      highlightVenueCard(venue);
    });
    fitBounds(venues);

    // Then get real OSRM routes in batch
    const dests = venues.map(v => ({ lat: v.lat, lng: v.lng }));
    const batchRoutes = await getRoutesForModes(
      { lat: userLocation.lat, lng: userLocation.lng },
      dests
    );

    const realRoutes = {};
    venues.forEach((v, i) => {
      realRoutes[v.id] = batchRoutes[i] || {};
    });
    window._venueRoutes = realRoutes;

    // Filter by max time
    const filtered = venues.filter(v => {
      const r = realRoutes[v.id];
      if (!r || Object.keys(r).length === 0) return true;
      const times = Object.values(r).filter(Boolean).map(x => x.duration);
      if (times.length === 0) return true;
      return Math.min(...times) <= filters.maxTime;
    });

    sortAndRender(filtered, realRoutes);

  } catch (err) {
    hideLoading();
    console.error(err);
    alert('Errore: ' + (err.message || 'Qualcosa è andato storto'));
  }
}

function sortAndRender(venues, routes) {
  const sortBy = document.getElementById('sort-select').value;
  const sorted = [...venues];

  if (sortBy === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name, 'it'));
  } else if (sortBy === 'time') {
    sorted.sort((a, b) => getBestTime(routes[a.id]) - getBestTime(routes[b.id]));
  } else {
    sorted.sort((a, b) => getBestDist(routes[a.id]) - getBestDist(routes[b.id]));
  }

  renderVenueList(sorted, routes, venue => {
    showVenueDetail(venue, routes);
    highlightVenueCard(venue);
  });

  if (!sortListenerAttached) {
    sortListenerAttached = true;
    document.getElementById('sort-select').addEventListener('change', () => {
      sortAndRender(window._lastVenues || sorted, window._venueRoutes || routes);
    });
  }

  window._lastVenues = sorted;
}

function getBestTime(r) {
  if (!r || Object.keys(r).length === 0) return Infinity;
  return Math.min(...Object.values(r).filter(Boolean).map(x => x.duration));
}

function getBestDist(r) {
  if (!r || Object.keys(r).length === 0) return Infinity;
  return Math.min(...Object.values(r).filter(Boolean).map(x => parseFloat(x.distance)));
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
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('location-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') performSearch();
});

document.getElementById('close-detail').addEventListener('click', hideVenueDetail);

window.addEventListener('DOMContentLoaded', initMap);

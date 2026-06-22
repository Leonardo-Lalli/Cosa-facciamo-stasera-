// ===== Venue Describer – auto-generate descriptions + pros/cons from OSM tags =====

function describeVenue(venue, tags) {
  const t = tags || {};
  const name = venue.name || 'Questo locale';
  const type = venue.type || 'bar';
  const label = venue.label || 'Locale';

  // Build description from available tags
  const desc = buildDescription(name, type, label, t);

  // Extract pros
  const pros = [];
  const cons = [];

  // --- Location vibe ---
  const suburb = t['addr:suburb'] || t['addr:district'];
  if (suburb) {
    pros.push(`Situato nel quartiere ${capitalize(suburb)}`);
  }

  // --- Outdoor / terrace ---
  if (t.outdoor_seating === 'yes' || t.outdoor_seating === 'terrace' || t.outdoor_seating === 'garden') {
    pros.push('Terrazza / spazio all\'aperto');
  } else if (type === 'bar' || type === 'pub' || type === 'restaurant') {
    cons.push('Solo posti al chiuso');
  }

  // --- Accessibility ---
  if (t.wheelchair === 'yes' || t.wheelchair === 'limited') {
    pros.push('Accessibile in sedia a rotelle');
  } else if (t.wheelchair === 'no') {
    cons.push('Non accessibile ai disabili');
  }

  // --- Wi-Fi ---
  if (t['internet_access'] === 'wlan' || t.wifi === 'yes' || t['internet_access:fee'] === 'no') {
    pros.push('Wi-Fi gratuito disponibile');
  } else if (type === 'bar' || type === 'pub' || type === 'restaurant') {
    cons.push('Wi-Fi non disponibile');
  }

  // --- Smoking ---
  if (t.smoking === 'no') {
    pros.push('Vietato fumare (aria pulita)');
  } else if (t.smoking === 'yes' || t.smoking === 'separated') {
    cons.push('È consentito fumare all\'interno');
  }

  // --- Live music ---
  if (t['live_music'] === 'yes' || type === 'live_music' || type === 'nightclub') {
    pros.push('Musica dal vivo / DJ set');
  }

  // --- Cuisine ---
  const cuisine = t.cuisine;
  if (cuisine) {
    const cuisines = cuisine.split(';').map(c => cuisineLabel(c.trim())).filter(Boolean);
    if (cuisines.length) pros.push(`Cucina: ${cuisines.join(', ')}`);
  }

  // --- Brewery ---
  if (t.brewery === 'yes' || t.microbrewery === 'yes' || t.craft === 'yes') {
    pros.push('Birrificio artigianale / birre artigianali');
  }

  // --- Opening hours ---
  const hours = t.opening_hours;
  if (hours) {
    const closingTime = extractClosingTime(hours);
    if (closingTime && closingTime >= 26) {
      pros.push('Aperto fino a tarda notte');
    } else if (closingTime && closingTime < 22) {
      cons.push(`Chiude presto (verso le ${closingTime}:00)`);
    }
  } else {
    cons.push('Orari di apertura non disponibili');
  }

  // --- Capacity ---
  if (t.capacity && parseInt(t.capacity) > 200) {
    pros.push(`Capienza: ${t.capacity} persone`);
  }

  // --- Parking ---
  if (t['parking:street'] === 'yes' || t.parking === 'yes' || t.parking === 'surface') {
    pros.push('Parcheggio disponibile');
  } else if (type === 'restaurant' || type === 'bar' || type === 'pub') {
    cons.push('Parcheggio non segnalato');
  }

  // --- TV / sport ---
  if (t.sport === 'yes' || t.tv === 'yes' || t.television === 'yes') {
    pros.push('Schermi per eventi sportivi');
  }

  // --- Credit cards ---
  if (t['payment:credit_cards'] === 'yes' || t['payment:cards'] === 'yes') {
    pros.push('Pagamento con carta accettato');
  } else if (t['payment:cash'] === 'only') {
    cons.push('Solo contanti');
  }

  // --- Noise level ---
  if (type === 'nightclub' || type === 'live_music') {
    cons.push('Ambiente rumoroso (tipico del locale)');
  }

  // --- Dress code hint ---
  if (type === 'nightclub' || type === 'casino') {
    pros.push('Dress code elegante richiesto');
  }

  return { description: desc, pros: pros.slice(0, 5), cons: cons.slice(0, 4) };
}

function buildDescription(name, type, label, t) {
  const adjectives = [];

  if (t.building === 'historic' || t['building:architecture'] || t.heritage) {
    adjectives.push('storico');
  }
  if (t.brewery === 'yes' || t.microbrewery === 'yes') {
    adjectives.push('artigianale');
  }
  if (t.organic === 'yes' || t['diet:organic'] === 'yes') {
    adjectives.push('biologico');
  }
  if (t.stars >= 4) {
    adjectives.push('rinomato');
  }
  if (t.stars >= 5) {
    adjectives.push('di alta classe');
  }

  const localeLabel = type === 'nightclub' ? 'discoteca' :
    type === 'live_music' ? 'locale di musica dal vivo' :
    type === 'dance_hall' ? 'sala da ballo' :
    type === 'events_venue' ? 'sala eventi' :
    label.toLowerCase();

  const city = t['addr:city'] || t['addr:town'] || '';
  const street = t['addr:street'] || '';

  const templates = [
    `${name} è un${isVowel(localeLabel[0]) ? "'" : ' '}${localeLabel}${adjectives.length ? ' ' + adjectives.join(' e ') : ''}${street ? ' in ' + street : ''}${city ? ', ' + city : ''}. Ideale per ${idealFor(type)}.`,
    `Scopri ${name}, ${adjectives.length ? adjectives.join(' e ') + ' ' : ''}${localeLabel} nel${suburb(t) ? ' quartiere ' + suburb(t) : city ? 'la zona di ' + city : 'la tua zona'}. Perfetto per ${idealFor(type)}.`,
    `${name} ti aspetta${street ? ' in ' + street : ''}${city ? ', ' + city : ''}. Questo ${localeLabel}${adjectives.length ? ' ' + adjectives.join(' e ') : ''} è la scelta giusta per ${idealFor(type)}.`,
  ];

  return templates[Math.floor(Math.random() * templates.length)];
}

function idealFor(type) {
  const map = {
    nightclub: 'ballare tutta la notte e serate con DJ set',
    bar: 'un aperitivo o un drink dopo il lavoro',
    pub: 'birre in compagnia e partite in TV',
    cinema: 'una serata al cinema con gli ultimi film in programmazione',
    theatre: 'spettacoli teatrali e performance dal vivo',
    restaurant: 'cene romantiche o uscite in gruppo',
    live_music: 'ascoltare concerti e musica dal vivo',
    bowling: 'divertirsi tra amici con birra e birilli',
    dance_hall: 'ballare tutti i generi, dal latino al liscio',
    events_venue: 'feste private, compleanni ed eventi',
    casino: 'tentare la fortuna al tavolo verde',
    arcade: 'videogiochi e divertimento retrò',
    karaoke: 'cantare le tue canzoni preferite',
  };
  return map[type] || 'una bella serata fuori';
}

function suburb(t) {
  return t['addr:suburb'] || t['addr:district'] || t['addr:neighbourhood'] || '';
}

function cuisineLabel(c) {
  const map = {
    italian: 'italiana', pizza: 'pizza', japanese: 'giapponese', chinese: 'cinese',
    indian: 'indiana', mexican: 'messicana', french: 'francese', mediterranean: 'mediterranea',
    seafood: 'pesce', steak_house: 'griglieria', burger: 'hamburger', sushi: 'sushi',
    regional: 'regionale', kebab: 'kebab', vegetarian: 'vegetariana', vegan: 'vegana',
    cocktail: 'cocktail', wine_bar: 'vini',
  };
  return map[c] || c;
}

function extractClosingTime(hoursStr) {
  const patterns = hoursStr.split(';');
  let latest = 0;
  for (const p of patterns) {
    const match = p.match(/(\d{2}):(\d{2})/g);
    if (match) {
      const last = match[match.length - 1];
      const [h, m] = last.split(':').map(Number);
      const val = h + m / 60;
      if (val > latest && val < 30) latest = val;
    }
  }
  return latest || null;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isVowel(c) {
  return 'aeiouàèéìòù'.includes(c.toLowerCase());
}

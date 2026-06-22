// ===== Evening Plan Loader =====
// Pre-generated AI plans (top 15 cities) or smart fallback for any city

async function loadCityPlan(cityName) {
  if (!cityName) return null;

  const safeName = cityName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  try {
    const resp = await fetch(`data/plans/${safeName}.json`);
    if (!resp.ok) return null;
    const data = await resp.json();
    return { source: 'ai', plans: data.plans || null };
  } catch {
    return null;
  }
}

function buildSmartPlan(venues, city) {
  if (!venues || venues.length === 0) return null;

  const bars = venues.filter(v => ['bar', 'pub'].includes(v.type));
  const rests = venues.filter(v => v.type === 'restaurant');
  const clubs = venues.filter(v => ['nightclub', 'live_music', 'dance_hall'].includes(v.type));
  const culture = venues.filter(v => ['cinema', 'theatre', 'events_venue'].includes(v.type));

  const pick = (arr, n = 1) => {
    const sorted = [...arr].sort((a, b) => (b.rating || 3) - (a.rating || 3));
    return sorted.slice(0, n);
  };

  const topBar = pick(bars)[0];
  const topRest = pick(rests)[0];
  const topClub = pick(clubs)[0];
  const topCulture = pick(culture)[0];

  const plans = {};

  if (topBar || topClub || topRest) {
    plans.party = {
      emoji: '🪩', label: 'Party',
      text: `🎉 Serata a ${city}:\n\n` +
        (topBar ? `🍺 Aperitivo da ${topBar.name}\n` : '') +
        (topRest ? `🍽️ Cena da ${topRest.name}\n` : '') +
        (topClub ? `🪩 Serata al ${topClub.name}\n` : '') +
        '\nBuon divertimento! 🎊',
    };
  }

  if (topCulture || topBar) {
    plans.culture = {
      emoji: '🎭', label: 'Cultura',
      text: `🎭 Serata culturale a ${city}:\n\n` +
        (topCulture ? `🎬 ${topCulture.name}\n` : '') +
        (topBar ? `🍸 Drink post-spettacolo da ${topBar.name}\n` : '') +
        '\nBuona serata! ✨',
    };
  }

  if (topRest || topBar) {
    plans.foodie = {
      emoji: '🍝', label: 'Food & Drink',
      text: `🍷 Percorso gastronomico a ${city}:\n\n` +
        (topBar ? `🍺 Aperitivo da ${topBar.name}\n` : '') +
        (topRest ? `🍽️ Cena da ${topRest.name}\n` : '') +
        (topBar && venues.filter(v => ['bar', 'pub'].includes(v.type)).length > 1
          ? `🍸 Digestivo al ${pick(bars.filter(b => b.name !== topBar.name))[0]?.name || 'bar più vicino'}\n`
          : '') +
        '\nBuon appetito! 🍷',
    };
  }

  return Object.keys(plans).length > 0 ? { source: 'smart', plans } : null;
}

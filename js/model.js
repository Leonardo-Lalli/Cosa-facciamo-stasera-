// Shared data rules. No external content is treated as HTML.
const CATEGORIES = [
  ['bar','◒','Aperitivo'], ['pub','♧','Pub'], ['restaurant','♜','Cena'],
  ['live_music','♫','Musica'], ['nightclub','✦','Ballo'], ['cinema','▣','Cinema'],
  ['arcade','⚄','Giochi'], ['bowling','●','Bowling'], ['theatre','◇','Teatro'],
  ['events_venue','◎','Eventi'], ['dance_hall','♬','Danza'], ['karaoke','♩','Karaoke'], ['casino','♠','Casinò'],
];
const DEFAULT_TYPES = ['bar','pub','restaurant'];
const TRANSPORT_LABELS = { walking:'a piedi', cycling:'in bici', driving:'in auto', transit:'con i mezzi' };
function readStored(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function writeStored(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
function safeURL(value) {
  if (!value || typeof value !== 'string') return null;
  try { const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
    return ['https:','http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
function normalizeVenue(v) {
  const lat = Number(v.lat), lng = Number(v.lng);
  if (v.lat == null || v.lng == null || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat)>90 || Math.abs(lng)>180) return null;
  const def = VENUE_TYPES[v.type];
  if (!def) return null;
  return { id:String(v.id ?? `extra/${v.type}/${lat}/${lng}/${v.name}`), lat, lng,
    name:String(v.name || 'Locale senza nome'), type:v.type, icon:def.icon, label:def.label,
    address:String(v.address || 'Indirizzo non disponibile'), website:safeURL(v.website),
    phone:typeof v.phone==='string'?v.phone:null, openingHours:v.openingHours || v.opening_hours || null,
    source:v.source || 'Fonte aggiuntiva', tags:v.tags || {} };
}
function mergeNearby(primary, extra, origin, radius, types) {
  const result = [];
  const ids = new Set(), byName = new Map();
  for (const raw of [...primary, ...extra]) {
    const v = normalizeVenue(raw);
    if (!v || !types.includes(v.type) || haversineKm(origin,v)>radius) continue;
    const name = v.name.trim().toLocaleLowerCase('it');
    const sameName = byName.get(name) || [];
    if (ids.has(v.id) || sameName.some(p=>haversineKm(p,v)<0.08)) continue;
    result.push(v);ids.add(v.id);sameName.push(v);byName.set(name,sameName);
  }
  return result;
}
// Conservatively parse weekly OSM hours; unsupported expressions remain unknown.
function openingState(hours, date = new Date()) {
  if (!hours) return 'unknown';
  if (hours.trim()==='24/7') return 'open';
  const days = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  let today = date.getDay(), minutes = date.getHours()*60+date.getMinutes(), open = false;
  const rules = hours.split(';').map(rule => rule.trim()).filter(Boolean);
  for (const rule of rules) {
    const m = rule.match(/^(?:(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?(?:,((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:,(?:Mo|Tu|We|Th|Fr|Sa|Su))*))?\s+)?((?:\d{2}:\d{2}-\d{2}:\d{2})(?:,\s*\d{2}:\d{2}-\d{2}:\d{2})*)$/);
    if (!m) return 'unknown';
    let activeDays = [0,1,2,3,4,5,6];
    if (m[1]) {
      const from = days.indexOf(m[1]), to = days.indexOf(m[2]||m[1]);
      activeDays = [from];
      while (activeDays[activeDays.length-1]!==to) activeDays.push((activeDays[activeDays.length-1]+1)%7);
      if (m[3]) activeDays.push(...m[3].split(',').map(d=>days.indexOf(d)));
    }
    for (const range of m[4].split(',')) {
      const [a,b,c,d] = range.trim().split(/[:-]/).map(Number);
      if (a>23 || c>24 || b>59 || d>59 || (c===24 && d!==0)) return 'unknown';
      const start=a*60+b, end=c*60+d;
      if (end>start) { if(activeDays.includes(today) && minutes>=start && minutes<end) open=true; }
      else if ((activeDays.includes(today) && minutes>=start) || (activeDays.includes((today+6)%7) && minutes<end)) open=true;
    }
  }
  return rules.length ? (open?'open':'closed') : 'unknown';
}
function visibleVenues(venues, filters, origin) {
  let result = venues.filter(v=>filters.types.includes(v.type));
  if (filters.onlyOpen) result=result.filter(v=>openingState(v.openingHours)==='open');
  if (filters.maxTime && origin) result=result.filter(v=>estimate(origin,v,filters.transport).duration<=filters.maxTime);
  return result.sort(filters.sort==='name' ? (a,b)=>a.name.localeCompare(b.name,'it') :
    (a,b)=>origin ? haversineKm(origin,a)-haversineKm(origin,b) : a.name.localeCompare(b.name,'it'));
}

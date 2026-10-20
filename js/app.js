// App controller: explicit home entry, URL navigation, cancellable searches and local fallback.
const state={view:'home',origin:null,venues:[],events:[],visible:[],selected:null,busy:false,hasSearched:false,
  filters:{types:[...DEFAULT_TYPES],radius:5,transport:'walking',maxTime:0,onlyOpen:false,sort:'distance'},draft:{types:[...DEFAULT_TYPES]}};
let searchController=null,searchRevision=0,categoryTimer,installPrompt;
const sessionCache=new Map();
const geocodeCache=new Map();
async function fetchJSON(url, signal, timeoutMs=5000) {
  const controller=new AbortController();
  const abort=()=>controller.abort();
  if(signal?.aborted)abort();
  signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,timeoutMs);
  try {
    const response=await fetch(url,{signal:controller.signal});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
function setTheme(theme) { document.documentElement.dataset.theme=theme;S('theme-toggle').textContent=theme==='dark'?'☀':'☾';S('theme-toggle').setAttribute('aria-label',theme==='dark'?'Attiva tema chiaro':'Attiva tema scuro');document.querySelector('meta[name=theme-color]').content=theme==='dark'?'#0d1322':'#f8fafc'; }
function setLayout(layout) {
  S('explore-workspace').dataset.layout=layout;
  document.querySelectorAll('[data-layout]').forEach(button=>{if(button.tagName==='BUTTON')button.setAttribute('aria-pressed',String(button.dataset.layout===layout));});
  if(layout!=='list')initMap();
}
function showView() {
  clearTimeout(categoryTimer);
  const route=location.hash.slice(1);
  const view=route==='favorites'?'favorites':['explore','map','list'].includes(route)?'explore':'home';
  const old=state.view;state.view=view;
  if(view==='favorites'){searchController?.abort();++searchRevision;setBusy(false);}
  document.body.dataset.view=view;S('home-view').hidden=view!=='home';S('explore-view').hidden=view==='home';
  document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  if(view!=='home') {
    setLayout(view==='favorites' || route==='list'?'list':route==='map'?'map':'split');
    renderResults();
    if(view==='favorites')S('search-status').textContent='Preferiti salvati su questo dispositivo. Cerca una città per tornare a esplorare.';
    else if(old==='favorites')S('search-status').textContent=state.hasSearched?'Risultati dell’ultima ricerca.':'Scegli una città per iniziare.';
  } else {
    searchController?.abort();++searchRevision;setBusy(false);
    if(route==='how')requestAnimationFrame(()=>S('how').scrollIntoView());
    else if(old!=='home')window.scrollTo({top:0,behavior:'instant'});
  }
  document.title=view==='home'?'Cosa facciamo stasera? · Serata':view==='favorites'?'I tuoi preferiti · Serata':'Esplora la serata · Serata';
}
function updateRadius(radius) {
  state.filters.radius=Number(radius);S('home-radius').value=radius;S('home-radius-label').textContent=`${radius} km`;
  S('radius-summary').textContent=`Nel raggio di ${radius} km`;
  document.querySelectorAll('[data-radius]').forEach(button=>button.classList.toggle('active',Number(button.dataset.radius)===Number(radius)));
}
async function geocode(query,signal) {
  const key=query.trim().toLocaleLowerCase('it');
  if(geocodeCache.has(key))return {...geocodeCache.get(key),display:query};
  const url=`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&accept-language=it&q=${encodeURIComponent(query)}`;
  let places;
  try {places=await fetchJSON(url,signal);}catch(error){if(signal?.aborted)throw error;throw new Error('Ricerca città non disponibile. Riprova tra poco.');}
  if(!places.length)throw new Error('Città non trovata. Prova con comune e provincia.');
  const place=places[0];const origin={lat:Number(place.lat),lng:Number(place.lon),city:place.address?.city||place.address?.town||place.address?.village||query,display:query};
  geocodeCache.set(key,origin);if(geocodeCache.size>20)geocodeCache.delete(geocodeCache.keys().next().value);
  return origin;
}
async function fetchCityData(city,signal) {
  if(!city)return [];
  const slug=city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'-');
  try{const venues=(await fetchJSON(`data/cities/${slug}.json`,signal,3000)).venues;return Array.isArray(venues)?venues:[];}catch{return [];}
}
async function loadUpcomingEvents(origin,radius,signal) {
  try {
    const events=await fetchJSON('data/events.json',signal,3500);if(!Array.isArray(events))return [];
    const today=new Date();today.setHours(0,0,0,0);const limit=new Date(today);limit.setDate(limit.getDate()+60);
    return events.filter(event=>{
      const date=new Date(event.date);if(!event.date || !Number.isFinite(date.getTime()) || date<today || date>limit)return false;
      const hasCoords=event.lat!=null && event.lng!=null && Number.isFinite(Number(event.lat)) && Number.isFinite(Number(event.lng));
      return hasCoords ? haversineKm(origin,{lat:Number(event.lat),lng:Number(event.lng)})<=radius :
        !!origin.city && String(event.city||'').toLocaleLowerCase('it')===origin.city.toLocaleLowerCase('it');
    }).sort((a,b)=>new Date(a.date)-new Date(b.date));
  } catch {return [];}
}
function cacheKey(origin,filters) { return `${origin.lat.toFixed(4)}|${origin.lng.toFixed(4)}|${filters.radius}|${[...filters.types].sort().join(',')}`; }
function findSearchCache(origin,filters,key) {
  const saved=readStored('serata_recent_searches',[]);
  const records=[...sessionCache.values(),...(Array.isArray(saved)?saved:[])];
  const legacy=readStored('serata_last_search',null);if(legacy)records.push(legacy);
  return records.filter(record=>{
    if(!Array.isArray(record?.venues) || !Number.isFinite(record.time))return false;
    if(record.key===key)return true;
    return record.origin && Number.isFinite(record.radius) && Array.isArray(record.types) &&
      haversineKm(record.origin,origin)+filters.radius<=record.radius && filters.types.every(type=>record.types.includes(type));
  }).sort((a,b)=>b.time-a.time)[0];
}
function saveSearchCache(record) {
  sessionCache.set(record.key,record);if(sessionCache.size>8)sessionCache.delete(sessionCache.keys().next().value);
  const previous=readStored('serata_recent_searches',[]);
  writeStored('serata_recent_searches',[record,...(Array.isArray(previous)?previous:[]).filter(item=>item?.key!==record.key)].slice(0,4));
}
function scheduleSearch() {
  clearTimeout(categoryTimer);searchController?.abort();++searchRevision;
  renderSearchLoading();setBusy(true);S('search-status').textContent='Aggiorno i filtri…';
  categoryTimer=setTimeout(()=>searchVenues(),250);
}
async function searchVenues(originOverride,{force=false}={}) {
  clearTimeout(categoryTimer);
  const input=S('location-input').value.trim();
  if(!state.filters.types.length){S('search-status').textContent='Scegli almeno una categoria prima di cercare.';return;}
  if(!input && !state.origin && !originOverride){S('search-status').textContent='Inserisci una città oppure usa la posizione.';S('location-input').focus();return;}
  if(state.view==='favorites'){location.hash='explore';state.view='explore';}
  searchController?.abort();searchController=new AbortController();const controller=searchController;
  const revision=++searchRevision,filters={...state.filters,types:[...state.filters.types]};
  const timeout=setTimeout(()=>controller.abort(),22000);
  renderSearchLoading();setBusy(true);S('search-status').textContent='Cerco i posti nella tua zona…';
  let cachedVenues=[],origin;
  try {
    origin=originOverride || state.origin;
    if(!originOverride && (!origin || (input && input!==origin.display)))origin=await geocode(input,controller.signal);
    if(revision!==searchRevision)return;
    state.origin=origin;S('location-input').value=origin.display;S('home-location').value=origin.display;
    setSearchOrigin(origin,filters.radius);
    const key=cacheKey(origin,filters),cached=findSearchCache(origin,filters,key);
    let osmVenues=[],extraVenues=[],liveComplete=false,livePartial=false,liveError=null;
    const current=()=>revision===searchRevision && !controller.signal.aborted;
    function paint(venues,message) {
      if(!current())return;
      state.venues=venues;state.hasSearched=true;state.selected=null;
      S('search-status').textContent=message;renderResults();
    }
    const summary=`${origin.city||'Zona selezionata'} · ${filters.radius} km · Tempi indicativi.`;
    // Events never hold up the venue search, including when local venues are cached.
    loadUpcomingEvents(origin,filters.radius,controller.signal).then(events=>{
      if(!current() || state.view!=='explore')return;
      state.events=events;
      if(state.hasSearched){const scroll=S('venue-list').scrollTop;if(state.searchError)renderSearchFailure(state.searchError);else renderResults();S('venue-list').scrollTop=scroll;}
    });
    if(cached && Date.now()-cached.time<7*86400000) {
      cachedVenues=mergeNearby(cached.venues,[],origin,filters.radius,filters.types);
      const fresh=Date.now()-cached.time<300000 && !cached.partial;
      state.events=cached.events||[];
      paint(cachedVenues,fresh?`${summary} Risultati recenti già disponibili.`:'Risultati salvati: aggiorno i locali in background…');
      if(fresh && !force)return;
    }
    function applyLive() {
      const venues=mergeNearby(osmVenues,extraVenues,origin,filters.radius,filters.types);
      if(!current())return;
      if(venues.length || (liveComplete && !liveError)) {
        paint(venues,liveError?'Risultati dalle fonti aggiuntive. OpenStreetMap non risponde.':livePartial?'Risultati parziali: il server non ha completato tutta la ricerca.':liveComplete?summary:'Primi locali disponibili. Completo la ricerca…');
        if(liveComplete && !liveError)saveSearchCache({key,origin,radius:filters.radius,types:filters.types,venues,events:state.events,time:Date.now(),partial:livePartial});
      }
      return venues;
    }
    const extraTask=fetchCityData(origin.city,controller.signal).then(extra=>{if(current()){extraVenues=extra;applyLive();}});
    try {osmVenues=await fetchVenues(origin,filters.radius,filters.types,controller.signal);livePartial=!!osmVenues.partial;}
    catch(error){liveError=error;}
    if(!current()) {if(controller.signal.aborted)throw new DOMException('Ricerca interrotta','AbortError');return;}
    liveComplete=true;
    // Only on total OSM failure do we wait for the bounded (3 s) local fallback.
    if(liveError)await extraTask;
    const venues=applyLive();
    if(liveError && !venues?.length)throw new Error('Il servizio dei locali non risponde. Riprova tra poco o consulta i preferiti.');
    if(window.innerWidth>768 && state.visible.length)fitVenueBounds(state.visible);
  } catch(error) {
    if(revision!==searchRevision)return;
    const message=error.name==='AbortError'?'La ricerca impiega troppo tempo. Riprova con un raggio più piccolo.':error.message;
    if(cachedVenues.length){state.venues=cachedVenues;state.hasSearched=true;renderResults();}
    else {state.venues=[];state.hasSearched=true;state.searchError=message;renderSearchFailure(message);}
    S('search-status').replaceChildren(document.createTextNode(cachedVenues.length?'Mostro i risultati salvati: aggiornamento non riuscito. ':`${message} `),action('Riprova',()=>searchVenues(undefined,{force:true}),'button secondary retry-button'));
  } finally {clearTimeout(timeout);if(revision===searchRevision)setBusy(false);}
}
async function useGPS(fromHome=false) {
  const status=S(fromHome?'home-status':'search-status');
  if(!navigator.geolocation){status.textContent='GPS non supportato. Inserisci una città.';return;}
  status.textContent='Attendo la tua posizione…';
  navigator.geolocation.getCurrentPosition(async position=>{
    const origin={lat:position.coords.latitude,lng:position.coords.longitude,city:'',display:'Posizione attuale'};
    S('home-location').value=origin.display;S('location-input').value=origin.display;state.origin=origin;
    status.textContent='Posizione trovata.';
    if(fromHome){location.hash='explore';showView();}
    await searchVenues(origin);
  },()=>{status.textContent='Posizione non disponibile o non consentita. Puoi inserire la città.';},{timeout:10000,maximumAge:60000});
}
function initApp() {
  setTheme(readStored('serata_theme','dark'));updateFavoriteCount();renderCategories();showView();
  window.addEventListener('hashchange',showView);
  S('theme-toggle').addEventListener('click',()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';setTheme(theme);writeStored('serata_theme',theme);});
  S('home-radius').addEventListener('input',event=>updateRadius(event.target.value));
  document.querySelectorAll('[data-radius]').forEach(button=>button.addEventListener('click',()=>updateRadius(button.dataset.radius)));
  S('home-search').addEventListener('submit',event=>{
    event.preventDefault();const input=S('home-location').value.trim();if(!input)return;
    if(!state.filters.types.length){S('home-status').textContent='Scegli almeno un tipo di serata.';return;}
    S('location-input').value=input;location.hash='explore';showView();searchVenues();
  });
  S('explore-search').addEventListener('submit',event=>{event.preventDefault();searchVenues();});
  document.querySelector('.home-gps').addEventListener('click',()=>useGPS(true));S('locate-btn').addEventListener('click',()=>useGPS(false));
  S('filters-toggle').addEventListener('click',openFilters);
  S('radius-slider').addEventListener('input',event=>S('radius-value').textContent=`${event.target.value} km`);
  S('filters-form').addEventListener('submit',event=>{
    event.preventDefault();if(!state.draft.types.length){S('filter-status').textContent='Scegli almeno una categoria.';return;}
    state.filters={...state.filters,types:[...state.draft.types],radius:Number(S('radius-slider').value),transport:S('transport').value,maxTime:Number(S('max-time').value),onlyOpen:S('only-open').checked};
    updateRadius(state.filters.radius);renderCategories();S('filters-dialog').close();S('filter-count').textContent=state.filters.onlyOpen || state.filters.maxTime?'●':'';
    if(state.origin && state.view!=='favorites')searchVenues();else renderResults();
  });
  S('reset-filters').addEventListener('click',()=>{
    state.draft.types=[...DEFAULT_TYPES];S('radius-slider').value=5;S('radius-value').textContent='5 km';S('transport').value='walking';S('max-time').value=0;S('only-open').checked=false;renderCategories();
  });
  S('sort-select').addEventListener('change',event=>{state.filters.sort=event.target.value;renderResults();});
  document.querySelectorAll('[data-layout]').forEach(button=>{if(button.tagName==='BUTTON')button.addEventListener('click',()=>setLayout(button.dataset.layout));});
  document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>S(button.dataset.close).close()));
  document.querySelectorAll('[data-idea]').forEach(button=>button.addEventListener('click',()=>{state.filters.types=[button.dataset.idea];renderCategories();S('home-location').focus();S('home-search').scrollIntoView({block:'center'});}));
  S('search-area').addEventListener('click',()=>{if(!map)return;const center=map.getCenter();searchVenues({lat:center.lat,lng:center.lng,city:'Zona della mappa',display:'Zona della mappa'});});
  window.addEventListener('offline',()=>{if(state.view!=='home')S('search-status').textContent='Connessione assente. Puoi consultare i preferiti e i risultati già caricati.';});
  window.addEventListener('online',()=>toast('Connessione ripristinata. Puoi ripetere la ricerca.'));
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;S('install-btn').hidden=false;});
  S('install-btn').addEventListener('click',async()=>{if(!installPrompt)return;await installPrompt.prompt();installPrompt=null;S('install-btn').hidden=true;});
  if('serviceWorker' in navigator && !['localhost','127.0.0.1'].includes(location.hostname))navigator.serviceWorker.register('sw.js').then(reg=>{
    if(reg.waiting)toast('Aggiornamento pronto. Chiudi tutte le finestre di Serata e riapri l’app.');
    reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed' && navigator.serviceWorker.controller)toast('Nuova versione pronta: chiudi e riapri Serata.');});});
  }).catch(()=>{});
}
initApp();

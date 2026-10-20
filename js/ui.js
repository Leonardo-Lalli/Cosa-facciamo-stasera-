// DOM builders keep provider names, addresses and links out of HTML templates.
function el(tag,className,text) { const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node; }
function action(text,fn,className='button secondary') { const button=el('button',className,text);button.type='button';button.addEventListener('click',fn);return button; }
function link(text,url,className='button secondary') { const a=el('a',className,text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a; }
let toastTimeout;
function toast(text) { const node=S('toast');node.textContent=text;node.hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>node.hidden=true,4000); }
function getFavorites() { const value=readStored('stasera_favs',[]);return Array.isArray(value)?value.map(normalizeVenue).filter(Boolean):[]; }
function isFavorite(id) { return getFavorites().some(v=>v.id===String(id)); }
function toggleFavorite(venue) {
  const favorites=getFavorites();const index=favorites.findIndex(v=>v.id===venue.id);
  index<0?favorites.push(venue):favorites.splice(index,1);
  if(!writeStored('stasera_favs',favorites))toast('Impossibile salvare i preferiti su questo dispositivo.');
  updateFavoriteCount();
  document.querySelectorAll('.fav-btn').forEach(button=>{
    if(button.dataset.id!==venue.id)return;
    button.setAttribute('aria-pressed',String(isFavorite(venue.id)));button.textContent=isFavorite(venue.id)?'♥':'♡';
  });
}
function updateFavoriteCount() { S('favorite-count').textContent=getFavorites().length; }
function shareVenue(venue) {
  const maps=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.lat},${venue.lng}`)}`;
  return `Stasera qui? ${venue.name}\n${venue.address}\n${maps}\nTrovato su Serata: ${location.href.split('#')[0]}`;
}
async function copyVenue(venue) {
  const text=shareVenue(venue);
  try { if(navigator.share)await navigator.share({title:venue.name,text});else{await navigator.clipboard.writeText(text);toast('Link del locale copiato.');} }
  catch(error){if(error.name!=='AbortError')toast('Condivisione non disponibile. Usa il pulsante WhatsApp.');}
}
function navigateURL(venue) { const mode={walking:'walking',cycling:'bicycling',driving:'driving',transit:'transit'}[state.filters.transport];return `https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}&travelmode=${mode}`; }
function openingLabel(hours) {
  const status=openingState(hours);
  return status==='open'?'● Aperto secondo gli orari disponibili':status==='closed'?'Orari disponibili: ora risulta chiuso':hours?'Orari da verificare':'Orari non disponibili';
}
function distanceLabel(venue) {
  if(!state.origin)return 'Imposta un ritrovo per vedere distanza e tempi';
  const route=estimate(state.origin,venue,state.filters.transport);
  return `${route.distance} km · ~${Math.max(1,route.duration)} min ${TRANSPORT_LABELS[state.filters.transport]}`;
}
function selectVenue(venue) {
  state.selected=venue.id;
  document.querySelectorAll('.venue-card').forEach(card=>card.classList.toggle('selected',card.dataset.id===venue.id));
  highlightMarker(venue.id);showVenueDetail(venue);
}
function venueCard(venue) {
  const card=el('article','venue-card');card.dataset.id=venue.id;
  card.classList.toggle('selected',state.selected===venue.id);
  const top=el('div','card-top');top.append(el('span','card-tag',`${venue.icon} ${venue.label.toUpperCase()}`));
  const fav=action(isFavorite(venue.id)?'♥':'♡',()=>{toggleFavorite(venue);if(state.view==='favorites')renderResults();},'fav-btn');
  fav.dataset.id=venue.id;fav.setAttribute('aria-label',`Salva o rimuovi ${venue.name} dai preferiti`);fav.setAttribute('aria-pressed',String(isFavorite(venue.id)));top.append(fav);
  const name=action(venue.name,()=>selectVenue(venue),'venue-name');
  card.append(top,name,el('p','venue-distance',distanceLabel(venue)),el('p',`open-status ${openingState(venue.openingHours)==='open'?'open':''}`,openingLabel(venue.openingHours)),el('p','venue-address',`⌖ ${venue.address}`));
  const actions=el('div','venue-actions');actions.append(link('↗ WhatsApp',`https://wa.me/?text=${encodeURIComponent(shareVenue(venue))}`),link('➤ Naviga',navigateURL(venue)),action('Dettagli',()=>selectVenue(venue)));
  card.append(actions,el('p','source-note',`Fonte: ${venue.source==='osm'?'OpenStreetMap':venue.source} · tempi indicativi`));
  return card;
}
function renderResults() {
  const list=S('venue-list');list.replaceChildren();
  const favorites=state.view==='favorites';
  const venues=favorites?getFavorites():state.venues;
  const visible=visibleVenues(venues,{...state.filters,types:favorites?Object.keys(VENUE_TYPES):state.filters.types},state.origin);
  state.visible=visible;
  S('results-label').textContent=favorites?'I TUOI POSTI DEL CUORE':'I POSTI PER STASERA';
  S('results-count').textContent=`${visible.length} ${favorites?'preferiti':'locali trovati'}`;
  S('radius-summary').textContent=`Nel raggio di ${state.filters.radius} km`;
  if(!favorites && state.events.length) {
    const events=el('details','events-section');events.open=!visible.length;
    events.append(el('summary','',`Eventi in zona (${state.events.length})`));
    state.events.slice(0,10).forEach(event=>{
      const card=el('article','event-card');card.append(el('strong','',String(event.name||'Evento')),el('p','field-note',`${new Date(event.date).toLocaleDateString('it-IT')} · ${String(event.venue||event.city||'')}`));
      const url=safeURL(event.url);if(url)card.append(link('Info e biglietti ↗',url));events.append(card);
    });list.append(events);
  }
  if(!visible.length) {
    const empty=el('div','empty-state');
    empty.append(el('span','',favorites?'♡':'✦'),el('h3','',favorites?'I bei posti si tengono stretti.':state.hasSearched?'Nessun posto con questi filtri.':'La serata è tutta da scegliere.'),
      el('p','',favorites?'Salva un locale con il cuore: lo ritroverai qui, su questo dispositivo.':state.hasSearched?'Prova ad ampliare il raggio o scegliere altre categorie. La copertura delle fonti può essere incompleta.':'Inserisci la città o usa la posizione per trovare il vostro prossimo ritrovo.'));
    empty.append(action(favorites?'Esplora i locali':'Modifica la ricerca',()=>{if(favorites)location.hash='explore';else openFilters();}));list.append(empty);
  } else {
    let offset=0;const more=action('Mostra altri locali',appendPage,'button secondary load-more');
    function appendPage(){const fragment=document.createDocumentFragment();visible.slice(offset,offset+40).forEach(v=>fragment.append(venueCard(v)));offset+=40;more.remove();list.append(fragment);if(offset<visible.length)list.append(more);}
    appendPage();
  }
  if(initMap())addVenueMarkers(visible,selectVenue);
}
function renderSearchLoading() {
  state.venues=[];state.events=[];state.visible=[];state.selected=null;state.hasSearched=false;state.searchError=null;
  S('venue-detail').close();
  S('results-count').textContent='Cerco i locali…';
  const loading=el('div','empty-state');
  loading.append(el('span','','⌕'),el('h3','','Una nuova zona da scoprire.'),el('p','','Cerco i locali. Gli eventi saranno caricati separatamente.'));
  S('venue-list').replaceChildren(loading);
  if(map){map.closePopup();addVenueMarkers([],selectVenue);}
}
function renderSearchFailure(message) {
  const error=el('div','empty-state');
  error.append(el('span','','!'),el('h3','','La ricerca non è disponibile.'),el('p','',message),action('Riprova',()=>searchVenues(undefined,{force:true})));
  if(state.events.length){
    renderResults();S('venue-list').querySelector('.empty-state')?.remove();S('venue-list').append(error);
    S('results-count').textContent=`Locali non disponibili · ${state.events.length} eventi`;
  }else {S('venue-list').replaceChildren(error);S('results-count').textContent='Ricerca non completata';}
}
function showVenueDetail(venue) {
  const content=S('detail-content');content.replaceChildren();
  const title=el('h2','',venue.name);title.id='detail-title';
  content.append(el('div','detail-icon',venue.icon),title,el('span','pill',venue.label),el('p','',venue.address),el('p','',distanceLabel(venue)),el('p','',openingLabel(venue.openingHours)));
  if(venue.openingHours)content.append(el('p','',`Orari forniti dalla fonte: ${venue.openingHours}`));
  const tags=el('div','detail-tags');
  if(venue.tags.outdoor_seating==='yes')tags.append(el('span','pill','Spazio all’aperto'));
  if(venue.tags.wheelchair==='yes')tags.append(el('span','pill','Accesso in sedia a rotelle'));
  if(venue.tags.internet_access==='wlan')tags.append(el('span','pill','Wi-Fi segnalato'));
  content.append(tags);
  const actions=el('div','detail-links');
  actions.append(link('➤ Apri indicazioni',navigateURL(venue),'button primary'),link('WhatsApp',`https://wa.me/?text=${encodeURIComponent(shareVenue(venue))}`),action('Condividi / copia',()=>copyVenue(venue)));
  const fav=action(isFavorite(venue.id)?'♥ Salvato':'♡ Salva posto',()=>{toggleFavorite(venue);fav.textContent=isFavorite(venue.id)?'♥ Salvato':'♡ Salva posto';if(state.view==='favorites')renderResults();});actions.append(fav);
  if(safeURL(venue.website))actions.append(link('Sito del locale ↗',safeURL(venue.website)));
  if(venue.phone && /^[+\d\s()./-]+$/.test(venue.phone))actions.append(link(`Chiama ${venue.phone}`,`tel:${venue.phone.replace(/[^+\d]/g,'')}`));
  content.append(actions,el('p','source-note','Distanze e tempi sono stime in linea d’aria. Verifica percorso, orari e disponibilità prima di partire.'));
  const dialog=S('venue-detail');if(!dialog.open)dialog.showModal();
}
function renderCategories() {
  ['home-categories','explore-categories','filter-categories'].forEach(id=>{
    const container=S(id);container.replaceChildren();
    const types=id==='filter-categories'?state.draft.types:state.filters.types;
    CATEGORIES.forEach(([type,icon,label],index)=>{
      if(id!=='filter-categories' && index>6 && !types.includes(type))return;
      const button=action(`${icon} ${label}`,()=>{
        const target=id==='filter-categories'?state.draft:state.filters;
        target.types=target.types.includes(type)?target.types.filter(t=>t!==type):[...target.types,type];
        renderCategories();
        if(id==='explore-categories' && state.origin)scheduleSearch();
      },'category-chip');
      button.dataset.type=type;button.setAttribute('aria-pressed',String(types.includes(type)));container.append(button);
    });
  });
}
function openFilters() {
  state.draft={...state.filters,types:[...state.filters.types]};
  S('radius-slider').value=state.draft.radius;S('radius-value').textContent=`${state.draft.radius} km`;
  S('transport').value=state.draft.transport;S('max-time').value=state.draft.maxTime;S('only-open').checked=state.draft.onlyOpen;
  S('filter-status').textContent='';renderCategories();S('filters-dialog').showModal();
}
function setBusy(busy) {
  state.busy=busy;S('search-btn').disabled=busy;
  S('search-btn').textContent=busy?'Cerco…':'Cerca';
  S('venue-list').setAttribute('aria-busy',String(busy));
}

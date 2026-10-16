// The map is created only after the user enters Explore. The home never loads tiles.
let map, tileLayer, venueLayer, userMarker, venueCanvas;
let venueMarkerMap = new Map();
let selectedMarker = null;
let mapMoveByUser = false;
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
function initMap() {
  if (map) { requestAnimationFrame(()=>map.invalidateSize({pan:false})); return true; }
  if (!window.L) {
    S('map-status').textContent='La mappa non è disponibile. Usa la lista dei locali.';
    S('map-status').hidden=false;
    return false;
  }
  map=L.map('map',{zoomControl:true,preferCanvas:true}).setView([41.9028,12.4964],12);
  map.attributionControl.setPrefix(false);
  venueCanvas=L.canvas({padding:.3});
  let failures=0;
  tileLayer=L.tileLayer(TILE_URL,{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'});
  tileLayer.on('loading',()=>{failures=0;});
  tileLayer.on('tileerror',()=>{if(++failures>=3){S('map-status').textContent='Cartografia non disponibile. Puoi continuare dalla lista.';S('map-status').hidden=false;}});
  tileLayer.on('load',()=>{if(!failures)S('map-status').hidden=true;});
  tileLayer.addTo(map);
  venueLayer=L.layerGroup().addTo(map);
  map.on('dragstart',()=>{mapMoveByUser=true;});
  map.on('zoomstart',event=>{if(event.originalEvent)mapMoveByUser=true;});
  map.on('moveend',()=>{if(mapMoveByUser){S('search-area').hidden=false;mapMoveByUser=false;}});
  if(window.ResizeObserver)new ResizeObserver(()=>map.invalidateSize({pan:false})).observe(S('map-container'));
  requestAnimationFrame(()=>map.invalidateSize());
  return true;
}
function setSearchOrigin(origin,radius) {
  if(!map)return;
  const point=[origin.lat,origin.lng];
  if(userMarker)map.removeLayer(userMarker);
  userMarker=L.circleMarker(point,{radius:9,color:'#fff',weight:3,fillColor:'#ff5745',fillOpacity:1}).addTo(map);
  const label=document.createElement('span');label.textContent='Il vostro ritrovo';userMarker.bindPopup(label);
  map.setView(point, radius>15?11:13);
  S('search-area').hidden=true;
}
function addVenueMarkers(venues,onClick) {
  if(!map)return;
  venueLayer.clearLayers();venueMarkerMap.clear();selectedMarker=null;
  const dense=venues.length>180;
  venues.forEach(venue=>{
    const marker=dense?L.circleMarker([venue.lat,venue.lng],{renderer:venueCanvas,radius:7,color:'#fff',weight:2,fillColor:'#a78bfa',fillOpacity:.95}):
      L.marker([venue.lat,venue.lng],{title:venue.name,alt:venue.name,icon:L.divIcon({className:'venue-marker',html:`<span class="map-pin">${VENUE_TYPES[venue.type]?.icon||'•'}</span>`,iconSize:[34,34],iconAnchor:[17,17]})});
    const popup=document.createElement('div');const title=document.createElement('strong');title.textContent=venue.name;
    const address=document.createElement('p');address.textContent=venue.address;popup.append(title,address);
    marker.bindPopup(popup).on('click',()=>onClick(venue));marker.addTo(venueLayer);venueMarkerMap.set(venue.id,marker);
  });
}
function highlightMarker(id) {
  if(!map)return;
  if(selectedMarker?.setStyle)selectedMarker.setStyle({fillColor:'#a78bfa',radius:7});
  selectedMarker?.getElement()?.querySelector('.map-pin')?.classList.remove('active');
  const marker=venueMarkerMap.get(id);if(!marker)return;
  selectedMarker=marker;
  if(marker.setStyle){marker.setStyle({fillColor:'#ff5745',radius:11});marker.bringToFront();}
  marker.getElement()?.querySelector('.map-pin')?.classList.add('active');
  marker.openPopup();
}
function fitVenueBounds(venues) {
  if(!map || !venues.length)return;
  const bounds=L.latLngBounds(venues.map(v=>[v.lat,v.lng]));
  if(userMarker)bounds.extend(userMarker.getLatLng());
  map.fitBounds(bounds,{padding:[40,40],maxZoom:15,animate:false});
}

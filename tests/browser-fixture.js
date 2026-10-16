// Loaded ONLY by the local test server when SERATA_TEST_FIXTURES=1.
const realFetch=window.fetch.bind(window);
const fixtureVenues=Array.from({length:95},(_,i)=>({type:'node',id:i+1,lat:44.4949+(i%10)*.001,lon:11.3426+Math.floor(i/10)*.001,tags:{name:i===0?'Test <img src=x onerror=alert(1)>':`Locale di collaudo ${i+1}`,amenity:i%2?'pub':'bar','addr:street':'Via di prova','addr:housenumber':String(i+1),opening_hours:i%3?'Mo-Su 18:00-02:00':'24/7',website:i===0?'javascript:alert(1)':'https://example.org'}}));
window.fetch=async (url,options={})=>{
  if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
  if(String(url).includes('nominatim.openstreetmap.org'))return new Response(JSON.stringify([{lat:'44.4949',lon:'11.3426',address:{city:'Bologna'}}]));
  if(String(url).includes('/api/interpreter'))return new Response(JSON.stringify({elements:fixtureVenues}));
  if(String(url).includes('data/cities/'))return new Response(JSON.stringify({venues:[]}));
  return realFetch(url,options);
};
window.addEventListener('DOMContentLoaded',()=>{
  const note=document.createElement('p');note.textContent='COLLAUDO LOCALE · DATI SIMULATI';note.style.cssText='position:fixed;top:0;left:0;right:0;text-align:center;z-index:9999;background:#cebdff;color:#0d1322;font:10px system-ui;pointer-events:none';document.body.append(note);
});

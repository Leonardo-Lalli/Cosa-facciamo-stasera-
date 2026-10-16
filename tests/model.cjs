const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx=vm.createContext({URL,localStorage:{getItem(){throw new Error('blocked');},setItem(){throw new Error('full');}}});
for(const file of ['api','routing','model'])vm.runInContext(fs.readFileSync(`js/${file}.js`,'utf8'),ctx);
const run=code=>vm.runInContext(code,ctx);
test('unsafe URL schemes rejected; HTTPS shorthand allowed',()=>{
  for(const value of ['javascript:alert(1)','data:text/html,hello','file:///tmp/a','vbscript:test'])assert.equal(ctx.safeURL(value),null);
  assert.equal(ctx.safeURL('example.com'),'https://example.com/');
});
test('local storage disabled or full does not break startup',()=>{
  assert.equal(ctx.readStored('x','dark'),'dark');assert.equal(ctx.writeStored('x',[]),false);
});
test('overnight hours use the previous day; unsupported holidays stay unknown',()=>{
  assert.equal(run("openingState('Fr 22:00-02:00',new Date(2026,9,17,1,0))"),'open');
  assert.equal(run("openingState('Fr 22:00-02:00',new Date(2026,9,16,1,0))"),'closed');
  assert.equal(run("openingState('Mo-Su 18:00-24:00; PH off')"),'unknown');
  assert.equal(ctx.openingState(null),'unknown');
  assert.equal(ctx.openingState('24/7'),'open');
});
test('day ranges including Sunday to Monday and split hours are supported',()=>{
  assert.equal(run("openingState('Su-Mo 12:00-14:00,18:00-23:00',new Date(2026,9,19,20,0))"),'open');
  assert.equal(run("openingState('Su-Mo 12:00-14:00,18:00-23:00',new Date(2026,9,19,16,0))"),'closed');
});
test('merge respects radius, categories, valid coordinates and nearby duplicates',()=>{
  const result=ctx.mergeNearby([
    {id:1,name:'Pub',lat:45,lng:9,type:'pub'},
    {id:2,name:'Pub',lat:45.00001,lng:9,type:'pub'},
    {id:3,name:'Far',lat:46,lng:9,type:'pub'},
    {id:4,name:'Bad',lat:null,lng:9,type:'pub'},
    {id:5,name:'Cafe',lat:45,lng:9,type:'bar'}
  ],[],{lat:45,lng:9},5,['pub']);
  assert.equal(result.length,1);assert.equal(result[0].name,'Pub');
});
test('transport time filter affects results and zero distance is valid',()=>{
  const venues=[{id:1,name:'A',lat:45,lng:9,type:'pub'},{id:2,name:'B',lat:45.05,lng:9,type:'pub'}];
  const filters={types:['pub'],maxTime:15,transport:'walking',sort:'distance'};
  assert.equal(ctx.visibleVenues(venues,filters,{lat:45,lng:9}).length,1);
  assert.equal(ctx.visibleVenues(venues,{...filters,transport:'driving'},{lat:45,lng:9}).length,2);
});
test('home is visible and explore hidden in initial HTML, Leaflet is local',()=>{
  const html=fs.readFileSync('index.html','utf8');
  assert.match(html,/<section id="explore-view"[^>]+hidden>/);assert.doesNotMatch(html,/landing-map|tailwindcss|unpkg\.com/);
  assert.match(html,/vendor\/leaflet\/leaflet.js/);
});

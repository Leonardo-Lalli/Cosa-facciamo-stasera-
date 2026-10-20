const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/api.js', 'utf8');
function api(fetch) {
  const context = vm.createContext({ fetch, AbortController, DOMException, setTimeout, clearTimeout, window: {} });
  vm.runInContext(source, context);
  return context;
}
test('all categories produce balanced selectors, relations and no 100-result truncation', () => {
  const ctx = api();
  const query = vm.runInContext('buildOverpassQuery({lat:45,lng:9},10000,Object.keys(VENUE_TYPES))', ctx);
  assert.equal((query.match(/\[/g)||[]).length, (query.match(/\]/g)||[]).length);
  const leisure = query.match(/nwr\["leisure"~"([^"]+)"\]/);
  assert.ok(leisure);
  const pattern = new RegExp(leisure[1]);
  for (const value of ['dance','bowling_alley','amusement_arcade']) assert.ok(pattern.test(value));
  assert.ok(!pattern.test('park'));
  assert.doesNotMatch(query, /out center 100/);
});
test('node and way sharing a numeric ID remain separate venues', async () => {
  const ctx = api(async () => ({ ok:true, json:async () => ({elements:[
    {type:'node',id:1,lat:45,lon:9,tags:{amenity:'bar',name:'A'}},
    {type:'way',id:1,center:{lat:45.01,lon:9},tags:{amenity:'bar',name:'B'}}
  ]}) }));
  const venues = await ctx.fetchVenues({lat:45,lng:9},10,['bar']);
  assert.equal(venues.length,2);
  assert.notEqual(venues[0].id,venues[1].id);
});
test('complete provider outage propagates instead of appearing as zero venues', async () => {
  const ctx = api(async () => { throw new Error('offline'); });
  await assert.rejects(ctx.fetchVenues({lat:45,lng:9},10,
    ['bar','pub','restaurant','cinema','theatre','nightclub','bowling']), /offline/);
});
test('partial Overpass response keeps available venues and signals incomplete coverage', async () => {
  const ctx = api(async () => {
    return {ok:true,json:async()=>({remark:'Query timed out',elements:[{type:'node',id:1,lat:45,lon:9,tags:{amenity:'bar'}}]})};
  });
  const venues = await ctx.fetchVenues({lat:45,lng:9},10,
    ['bar','pub','restaurant','cinema','theatre','nightclub','bowling']);
  assert.equal(venues.length,1);
  assert.equal(venues.partial,true);
});
test('all categories use one encoded request instead of parallel batches', async () => {
  const calls=[];
  const ctx=api(async (url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({elements:[]})};});
  await vm.runInContext('fetchVenues({lat:45,lng:9},5,Object.keys(VENUE_TYPES))',ctx);
  assert.equal(calls.length,1);
  assert.ok(calls[0].options.body.startsWith('data='));
  assert.match(decodeURIComponent(calls[0].options.body.slice(5)),/around:5000/);
});
test('rate-limited providers are not retried during the cooldown', async () => {
  const calls=[];
  const ctx=api(async url=>{calls.push(url);return {ok:false,status:406};});
  await assert.rejects(ctx.fetchVenues({lat:45,lng:9},5,['pub']));
  await assert.rejects(ctx.fetchVenues({lat:45,lng:9},5,['pub']));
  assert.equal(calls.length,2);
});
test('cancelled searches never contact the fallback provider',async()=>{
  let calls=0;
  const controller=new AbortController();
  const ctx=api(async()=>{calls++;controller.abort();throw new DOMException('Aborted','AbortError');});
  await assert.rejects(ctx.fetchVenues({lat:45,lng:9},5,['pub'],controller.signal),{name:'AbortError'});
  assert.equal(calls,1);
});

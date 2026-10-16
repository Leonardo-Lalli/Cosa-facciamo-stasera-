const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/api.js', 'utf8');
function api(fetch) {
  const context = vm.createContext({ fetch, AbortController, setTimeout, clearTimeout, window: {} });
  vm.runInContext(source, context);
  return context;
}
test('all categories produce balanced selectors, relations and no 100-result truncation', () => {
  const ctx = api();
  const query = vm.runInContext('buildOverpassQuery({lat:45,lng:9},10000,Object.keys(VENUE_TYPES))', ctx);
  assert.equal((query.match(/\[/g)||[]).length, (query.match(/\]/g)||[]).length);
  assert.match(query, /nwr\["leisure"="dance"\]/);
  assert.match(query, /nwr\["leisure"="bowling_alley"\]/);
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
test('partial provider outage keeps available venues and signals incomplete coverage', async () => {
  const ctx = api(async (_, options) => {
    if (options.body.includes('bowling')) throw new Error('offline');
    return {ok:true,json:async()=>({elements:[{type:'node',id:1,lat:45,lon:9,tags:{amenity:'bar'}}]})};
  });
  const venues = await ctx.fetchVenues({lat:45,lng:9},10,
    ['bar','pub','restaurant','cinema','theatre','nightclub','bowling']);
  assert.equal(venues.length,1);
  assert.equal(ctx.window._venueSearchPartial,true);
});

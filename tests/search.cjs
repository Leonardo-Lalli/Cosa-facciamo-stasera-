const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function controller(){
  const nodes=new Map(),stored=new Map(),rendered=[];
  const node=()=>({value:'Bologna',textContent:'',scrollTop:0,disabled:false,replaceChildren(...children){this.children=children;},focus(){}});
  const context=vm.createContext({URL,AbortController,DOMException,setTimeout,clearTimeout,console,
    localStorage:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)},
    S:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},
    document:{createTextNode:text=>text},window:{innerWidth:390},location:{hash:'#explore'},
    setBusy(){},setSearchOrigin(){},fitVenueBounds(){},action:()=>({}),
    renderSearchLoading(){vm.runInContext('state.venues=[];state.events=[];state.hasSearched=false;',context);rendered.push('loading');},
    renderResults(){rendered.push(vm.runInContext('state.venues.map(v=>v.name).join(",")',context));},
    renderSearchFailure(){rendered.push('failed');}
  });
  for(const name of ['api','routing','model','app']){
    let source=fs.readFileSync(`js/${name}.js`,'utf8');if(name==='app')source=source.replace(/initApp\(\);\s*$/,'');
    vm.runInContext(source,context);
  }
  vm.runInContext("state.view='explore'",context);
  context.loadUpcomingEvents=()=>new Promise(()=>{});context.fetchCityData=async()=>[];
  return {ctx:context,run:code=>vm.runInContext(code,context),nodes,rendered};
}
const origin={lat:44.49,lng:11.34,city:'Bologna',display:'Bologna'};
const venue=(name,lat=44.49)=>({id:name,name,lat,lng:11.34,type:'pub'});
test('venue results finish even while event loading never resolves',{timeout:1000},async()=>{
  const {ctx,run}=controller();ctx.fetchVenues=async()=>[venue('Pub')];
  await ctx.searchVenues(origin);assert.equal(run('state.venues[0].name'),'Pub');
});
test('new searches clear old results immediately, including on provider failure',async()=>{
  const {ctx,run,rendered}=controller();const pending=deferred();
  run("state.venues=[{name:'Vecchio posto'}]");ctx.fetchVenues=()=>pending.promise;
  const search=ctx.searchVenues(origin);
  assert.equal(run('state.venues.length'),0);assert.equal(rendered[0],'loading');
  pending.reject(new Error('offline'));await search;
  assert.equal(run('state.venues.length'),0);assert.ok(rendered.includes('failed'));
});
test('an old request finishing late cannot replace the newer city',async()=>{
  const {ctx,run}=controller();const old=deferred();let calls=0;
  ctx.fetchVenues=()=>++calls===1?old.promise:Promise.resolve([venue('Nuovo posto',45)]);
  const first=ctx.searchVenues(origin);
  await ctx.searchVenues({...origin,lat:45,display:'Nuova città'});
  old.resolve([venue('Vecchio posto')]);await first;
  assert.equal(run('state.venues[0].name'),'Nuovo posto');
});
test('narrower radius and local-only filters reuse covered cached data',async()=>{
  const {ctx,run}=controller();let calls=0;ctx.fetchVenues=async()=>{calls++;return [venue('Pub')];};
  await ctx.searchVenues(origin);
  run('state.filters.radius=2;state.filters.maxTime=30;state.filters.onlyOpen=true');
  await ctx.searchVenues(origin);assert.equal(calls,1);
});
test('explicit retry bypasses the fresh result cache',async()=>{
  const {ctx}=controller();let calls=0;ctx.fetchVenues=async()=>{calls++;return [venue('Pub')];};
  await ctx.searchVenues(origin);await ctx.searchVenues(origin,{force:true});assert.equal(calls,2);
});
test('fast local supplemental data is displayed before slow Overpass completes',async()=>{
  const {ctx,run}=controller();const pending=deferred();
  ctx.fetchCityData=async()=>[venue('Fonte aggiuntiva')];ctx.fetchVenues=()=>pending.promise;
  const search=ctx.searchVenues(origin);await Promise.resolve();await Promise.resolve();
  assert.equal(run('state.venues[0].name'),'Fonte aggiuntiva');
  pending.resolve([venue('OSM')]);await search;assert.equal(run('state.venues.length'),2);
});

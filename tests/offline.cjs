const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('offline shell includes every script, stylesheet and manifest referenced by the app',()=>{
  const ctx=vm.createContext({URL,self:{registration:{scope:'https://example.org/serata/'},addEventListener(){}}});
  vm.runInContext(fs.readFileSync('sw.js','utf8'),ctx);
  const cached=vm.runInContext('[...ASSET_URLS]',ctx);
  const html=fs.readFileSync('index.html','utf8');
  for(const [,asset] of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
    if(/^(https?:|mailto:)/.test(asset))continue;
    assert.ok(fs.existsSync(asset),asset);
    assert.ok(cached.includes(new URL(asset,'https://example.org/serata/').href),`Not cached: ${asset}`);
  }
  assert.ok(cached.every(url=>url.startsWith('https://example.org/serata/')));
});

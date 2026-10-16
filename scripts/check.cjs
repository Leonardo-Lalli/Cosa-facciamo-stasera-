const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
for(const dir of ['js','scripts']) for(const name of fs.readdirSync(dir)) {
  if(!/\.(js|cjs)$/.test(name))continue;
  new vm.Script(fs.readFileSync(path.join(dir,name),'utf8'),{filename:path.join(dir,name)});
}
new vm.Script(fs.readFileSync('sw.js','utf8'),{filename:'sw.js'});
const html=fs.readFileSync('index.html','utf8');
for(const [,asset] of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
  if(!/^(https?:|mailto:)/.test(asset) && !fs.existsSync(asset))throw new Error(`Missing asset: ${asset}`);
}
console.log('Syntax and local asset references OK');

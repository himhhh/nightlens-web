import {fileURLToPath} from 'node:url';
import {readdirSync} from 'node:fs';import {spawnSync} from 'node:child_process';
for(const name of readdirSync(new URL('../web_app/',import.meta.url)).filter(name=>name.endsWith('.js'))){
 const result=spawnSync(process.execPath,['--check',fileURLToPath(new URL('../web_app/'+name,import.meta.url))],{stdio:'inherit'});if(result.status)process.exit(result.status);
}
console.log('All application JavaScript modules parsed successfully.');

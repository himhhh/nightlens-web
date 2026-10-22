import fs from 'node:fs';
import {describePOI,buildIconCatalog} from '../web_app/poi_catalog.js';
const path=new URL('../web_app/assets/data/patterns.json',import.meta.url),data=JSON.parse(fs.readFileSync(path));
for(const p of data.patterns)for(const q of p.pois)Object.assign(q,describePOI(q.rawType));
fs.writeFileSync(path,JSON.stringify(data));fs.writeFileSync(new URL('../web_app/assets/data/icon-catalog.json',import.meta.url),JSON.stringify(buildIconCatalog(data.patterns)));

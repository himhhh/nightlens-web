import {NIGHTLORD_NAMES} from './core.js';

/** One master mode governs BOTH the photo request and later candidate filtering. */
export function resolveRecognitionMode({automaticRecognition=true,filters={},detectedTerrain=null,detectedNightlord=null,observations=[]}={}){
 if(!automaticRecognition)return {requestTerrain:filters.terrain||'Default',filters:{terrain:filters.terrain||'',nightlord:filters.nightlord||'',spawn:filters.spawn||''},observations};
 return {requestTerrain:'Auto',filters:{terrain:detectedTerrain||'',nightlord:NIGHTLORD_NAMES[detectedNightlord?.id]?detectedNightlord.id:'',spawn:''},observations:observations.filter(o=>o.source!=='manual')};
}
// Older versions hid separately persisted selectors inside a collapsed section.
// Only an explicit choice of the NEW master switch can restore manual mode.
export function restoreAutomaticRecognition(record){return record?.automaticRecognition!==false;}

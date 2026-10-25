/** Public-reference coordinates in the 1000 × 1000 map space. Shared roads and
 * rivers establish geometry; these regions verify which terrain is present. */
export const TERRAIN_REGIONS={
 Default:[],
 Mountaintop:[{x:180,y:180,width:250,height:250}],
 Crater:[{x:420,y:230,width:220,height:270}],
 'Rotted Woods':[{x:620,y:535,width:250,height:300}],
 Noklateo:[{x:175,y:615,width:240,height:235}],
 'Great Hollow':[{x:250,y:160,width:300,height:300},{x:300,y:480,width:300,height:300}],
};
export function ordinaryTerrainConfirmed(checks,changedTerrainConfirmed){
 return !changedTerrainConfirmed&&checks.length===4&&checks.every(check=>check.ok);
}
export function chooseVerifiedTerrain(alignments,evidence){
 const confirmed=evidence.filter(item=>item.confirmed),verified=confirmed.filter(item=>alignments.some(a=>a.terrain===item.terrain));
 if(confirmed.length!==1||verified.length!==1)return {ok:false,reason:confirmed.length>1?'多个地形的特有区域出现冲突，请拍清完整地图后重试':'未能确认地形特有区域，请拍清完整地图并避开遮挡后重试',terrainEvidence:evidence,mapCandidates:alignments.map(({terrain,quality,inliers})=>({terrain,quality,inliers}))};
 return {...alignments.find(a=>a.terrain===verified[0].terrain),terrainEvidence:evidence};
}

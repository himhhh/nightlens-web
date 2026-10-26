const DETAIL_SELECTOR='.boss-detail-dialog,#encounter-dialog';
export function createModalScrollLock({body,html,host}){
 let saved=null;
 const bodyKeys=['position','top','left','right','width','overflow'];
 function update(count){
  if(count>0&&!saved){
   saved={x:host.scrollX||0,y:host.scrollY||0,body:Object.fromEntries(bodyKeys.map(k=>[k,body.style[k]])),html:{overflow:html.style.overflow,overscrollBehavior:html.style.overscrollBehavior}};
   Object.assign(body.style,{position:'fixed',top:-saved.y+'px',left:-saved.x+'px',right:'0',width:'100%',overflow:'hidden'});
   html.style.overflow='hidden';html.style.overscrollBehavior='none';
  }else if(count===0&&saved){
   const previous=saved;saved=null;
   for(const key of bodyKeys)body.style[key]=previous.body[key];
   html.style.overflow=previous.html.overflow;html.style.overscrollBehavior=previous.html.overscrollBehavior;
   host.scrollTo(previous.x,previous.y);
  }
 }
 return {update,release:()=>update(0)};
}
export function canConsumeModalScroll(target,dialog,delta,getStyle){
 if(!target||!dialog.contains(target)||!delta)return false;
 for(let node=target.nodeType===3?target.parentElement:target;node;node=node.parentElement){
  const max=node.scrollHeight-node.clientHeight;
  if(max>1&&/auto|scroll/.test(getStyle(node).overflowY)){
   if(delta>0&&node.scrollTop<max-1||delta<0&&node.scrollTop>1)return true;
  }
  if(node===dialog)break;
 }
 return false;
}
export function mountDetailDialogs(root=document){
 const host=root.defaultView,lock=createModalScrollLock({body:root.body,html:root.documentElement,host}),opened=[];
 let lastTouch=null;
 function sync(){
  const visible=[...root.querySelectorAll(DETAIL_SELECTOR)].filter(d=>d.open);
  for(let i=opened.length-1;i>=0;i--)if(!visible.includes(opened[i]))opened.splice(i,1);
  for(const dialog of visible){dialog.classList.add('detail-sheet');if(!opened.includes(dialog))opened.push(dialog);}
  lock.update(opened.length);
 }
 const observer=new host.MutationObserver(sync);observer.observe(root.documentElement,{subtree:true,attributes:true,attributeFilter:['open']});
 const closed=()=>sync();root.addEventListener('close',closed,true);
 const started=event=>{if(opened.length&&event.touches.length===1)lastTouch={x:event.touches[0].clientX,y:event.touches[0].clientY};else lastTouch=null;};
 const moved=event=>{
  if(!opened.length||event.touches.length!==1||!lastTouch)return;
  const point=event.touches[0],dx=lastTouch.x-point.clientX,dy=lastTouch.y-point.clientY;lastTouch={x:point.clientX,y:point.clientY};
  if(Math.abs(dx)>Math.abs(dy)||!dy)return;
  if(!canConsumeModalScroll(event.target,opened.at(-1),dy,node=>host.getComputedStyle(node))&&event.cancelable)event.preventDefault();
 };
 const wheeled=event=>{
  if(!opened.length||event.ctrlKey||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
  if(!canConsumeModalScroll(event.target,opened.at(-1),event.deltaY,node=>host.getComputedStyle(node))&&event.cancelable)event.preventDefault();
 };
 root.addEventListener('touchstart',started,{passive:true});root.addEventListener('touchmove',moved,{passive:false});root.addEventListener('wheel',wheeled,{passive:false});sync();
 return {dispose(){observer.disconnect();root.removeEventListener('close',closed,true);root.removeEventListener('touchstart',started);root.removeEventListener('touchmove',moved);root.removeEventListener('wheel',wheeled);lock.release();}};
}

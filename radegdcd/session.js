(function(root){
  'use strict';
  let epoch=0,sources=new Map();
  const controllers=new Set(),listeners=new Set();
  function purgeLegacy(){
    for(const name of ['localStorage','sessionStorage'])try{
      const storage=root[name],keys=[];
      for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key&&key.startsWith('radegdcd_'))keys.push(key);}
      keys.forEach(key=>storage.removeItem(key));
    }catch{}
  }
  function abort(){epoch++;for(const controller of controllers)controller.abort();controllers.clear();}
  function clear(){abort();sources.clear();purgeLegacy();for(const callback of listeners)try{callback();}catch{}}
  function importSources(value){
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Tệp học liệu phải là đối tượng JSON theo từng mã bài.');
    const next=new Map(),entries=Object.entries(value);
    if(!entries.length||entries.length>200)throw new Error('Số bài trong tệp học liệu không hợp lệ.');
    for(const [id,row] of entries){
      if(!/^[A-Za-z0-9_-]{1,100}$/.test(id)||!row||typeof row.text!=='string'||row.text.trim().length<100||row.text.length>300000)throw new Error('Nội dung học liệu chưa hợp lệ ở bài '+id+'.');
      next.set(id,JSON.parse(JSON.stringify(row)));
    }
    sources=next;return sources.size;
  }
  root.GDCD_SESSION={epoch:()=>epoch,track(controller){controllers.add(controller);return()=>controllers.delete(controller);},abort,clear,purgeLegacy,importSources,source:id=>sources.get(id),sourceCount:()=>sources.size,onClear(callback){listeners.add(callback);return()=>listeners.delete(callback);}};
  purgeLegacy();
  root.addEventListener?.('pagehide',clear);
  root.addEventListener?.('pageshow',event=>{if(event.persisted){clear();root.location?.reload?.();}});
})(typeof globalThis!=='undefined'?globalThis:this);

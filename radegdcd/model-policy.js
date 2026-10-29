(function(root){
  'use strict';
  const idOf=value=>String(typeof value==='string'?value:value?.name||'').replace(/^models\//,'');
  function textModel(value){
    const id=idOf(value);
    if(!/^gemini-[a-zA-Z0-9._-]+$/.test(id))return false;
    if(/(?:image|tts|audio|live|embedding|robot|computer-use|deep-research|video|nano-banana)/i.test(id))return false;
    if(typeof value==='object'&&!(value.supportedGenerationMethods||[]).includes('generateContent'))return false;
    return true;
  }
  function maturity(id){return /experimental|(?:^|-)exp(?:-|$)/i.test(id)?3:/preview/i.test(id)?2:/latest/i.test(id)?1:0;}
  function version(id){return (id.match(/^gemini-(\d+(?:\.\d+)*)/)?.[1]||'0').split('.').map(Number);}
  function compare(a,b){
    const x=idOf(a),y=idOf(b);
    let d=maturity(x)-maturity(y);if(d)return d;
    d=Number(!/flash/i.test(x))-Number(!/flash/i.test(y));if(d)return d;
    const vx=version(x),vy=version(y);
    for(let i=0;i<Math.max(vx.length,vy.length);i++){d=(vy[i]||0)-(vx[i]||0);if(d)return d;}
    d=Number(/lite/i.test(x))-Number(/lite/i.test(y));if(d)return d;
    return y.localeCompare(x,undefined,{numeric:true});
  }
  function rank(values,excluded=[]){
    const blocked=new Set(excluded),unique=new Map();
    for(const value of values||[]){const id=idOf(value);if(textModel(value)&&!blocked.has(id)&&!unique.has(id))unique.set(id,value);}
    return [...unique.keys()].sort(compare);
  }
  function unavailable(error){
    if(error?.code==='GEMINI_MODEL_UNAVAILABLE')return true;
    const status=Number(error?.httpStatus||error?.status||0),message=String(error?.message||'');
    return [400,404,410].includes(status)&&/model[\s\S]*(?:no longer available|not found|not available|not supported|not exist|retired|deprecat|shut.?down)/i.test(message);
  }
  root.GDCD_MODEL_POLICY={idOf,textModel,compare,rank,unavailable};
})(typeof globalThis!=='undefined'?globalThis:this);

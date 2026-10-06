import {clock,currentBlock} from './core.js';
export function countdown(blocks,date=new Date()){
  const block=currentBlock(blocks,date);if(!block)return null;
  const remaining=Math.max(0,(block.endM-clock(date).minutes)*60-date.getUTCSeconds());
  return{block,remaining,text:String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0')};
}

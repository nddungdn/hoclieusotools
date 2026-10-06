import {DAYS,SESSIONS} from './core.js';

function periodLabel(periods){
  const ranges=[];
  for(let i=0;i<periods.length;i++){const start=periods[i];let end=start;while(periods[i+1]===end+1)end=periods[++i];ranges.push(start===end?String(start):start+'-'+end);}
  return ranges.join(', ');
}
// Giữ quy định tuần trong ghi chú nguồn, không suy ra tuần học từ ngày trên lịch.
export function scheduleNotes(item,kind){
  if(kind==='student')return [...(item.notes||[])];
  const groups=new Map();
  DAYS.forEach((day,d)=>SESSIONS.forEach(session=>{
    for(let p=1;p<=5;p++){
      const lessons=item.schedule[session][p-1][d],clauses=[];
      for(const week of [2,1]){
        const subjects=[...new Set(lessons.filter(l=>l.week===week).map(l=>l.subject+' (lớp '+l.classId.replace('.','/')+')'))];
        if(subjects.length)clauses.push('tuần '+(week===2?'chẵn':'lẻ')+' dạy '+subjects.join(' / '));
      }
      if(!clauses.length)continue;
      const text=clauses.join('; '),key=[d,session,text].join('|');
      if(!groups.has(key))groups.set(key,{day,session,text,periods:[]});groups.get(key).periods.push(p);
    }
  }));
  return [...groups.values()].map(g=>'Ghi chú: '+g.day+', '+g.session.toLowerCase()+', tiết '+periodLabel(g.periods)+': '+g.text+'.');
}

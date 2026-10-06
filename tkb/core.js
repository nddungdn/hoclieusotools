export const DAYS = ['Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
export const SESSIONS = ['Sáng','Chiều'];
export const clean = v => String(v ?? '').trim();
export const fold = v => clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase();
const head = v => fold(v).replace(/[^a-z0-9]/g,'');
export const identity = v => clean(v).normalize('NFC').toLocaleLowerCase('vi').replace(/[^\p{L}\p{N}]/gu,'');
export const classId = v => clean(v).replace(/\//g,'.');
export const natural = (a,b) => a.localeCompare(b,'vi',{numeric:true});
export const emptySchedule = () => Object.fromEntries(SESSIONS.map(s=>[s,Array.from({length:5},()=>Array.from({length:6},()=>[]))]));
export function lesson(text, kind='student') {
  return clean(text).split(/\r?\n/).filter(Boolean).map(line=>{
    const parts=line.split(/\s+[-–]\s+/), tail=parts.length>1?parts.pop():'';
    let subject=parts.join(' - '), week=null;
    const m=subject.match(/\(\s*(?:tuần\s*)?(chẵn|lẻ)\s*\)/i);
    if(m){week=fold(m[1])==='le'?1:2;subject=subject.replace(m[0],'').trim();}
    return {subject,week,teacher:kind==='student'?tail:'',classId:kind==='teacher'?classId(tail):''};
  });
}
export const active = (item,week) => !week || !item.week || item.week===week;
export function swipeDay(day,dx,dy){return Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.3?(day+(dx<0?1:5))%6:day;}
export function parseWeekNotes(text){
  return clean(text).split(/\r?\n/).filter(Boolean).map(line=>{
    const m=line.match(/^Ghi chú:\s*(Thứ [^,]+),\s*(sáng|chiều),\s*tiết\s*([1-5](?:\s*[-,]\s*[1-5])*)\s*:\s*tuần chẵn học\s+([^;]+);\s*tuần lẻ học\s+(.+?)\.?$/i);
    if(!m)throw Error('Ghi chú tuần phải ghi rõ thứ, buổi, tiết, môn tuần chẵn và môn tuần lẻ.');
    const day=DAYS.findIndex(d=>head(d)===head(m[1])),session=fold(m[2])==='sang'?'Sáng':'Chiều';
    if(day<0)throw Error('Thứ trong ghi chú tuần không hợp lệ.');
    const numbers=m[3].split(/\s*[-,]\s*/).map(Number);
    let periods=numbers;if(m[3].includes('-')){if(numbers.length!==2||numbers[1]<numbers[0])throw Error('Khoảng tiết trong ghi chú tuần không hợp lệ.');periods=Array.from({length:numbers[1]-numbers[0]+1},(_,i)=>numbers[0]+i);}
    if(new Set(periods).size!==periods.length)throw Error('Ghi chú tuần có tiết bị lặp.');
    return {day,session,periods,even:clean(m[4]),odd:clean(m[5])};
  });
}
export function parseStudents(rows, metadata=[]) {
  if(!Array.isArray(rows))throw Error('TKBHocSinh chưa có dữ liệu.');
  const hi=rows.findIndex(r=>r.map(head).includes('lop')&&r.map(head).includes('buoi')&&r.map(head).includes('tiet'));
  if(hi<0)throw Error('TKBHocSinh thiếu tiêu đề Lớp, Buổi, Tiết.');
  const h=rows[hi].map(head), ci=h.indexOf('lop'), si=h.indexOf('buoi'), pi=h.indexOf('tiet'), gi=h.indexOf('gvcn');
  const dayCols=DAYS.map((d,i)=>h.findIndex(x=>x===head(d)||x==='thu'+(i+2)));
  if(dayCols.some(c=>c<0))throw Error('TKBHocSinh thiếu cột thứ trong tuần.');
  const meta=new Map(metadata.map(m=>[classId(m.classId),m])), result=new Map(), seen=new Map();
  let id='',session='';
  for(let r=hi+1;r<rows.length;r++){
    const row=rows[r], raw=classId(row[ci]);
    if(raw){if(!/^\d+\.\d+$/.test(raw))throw Error('Mã lớp không hợp lệ ở dòng '+(r+1));id=raw;session='';}
    if(!id)continue;
    if(!result.has(id))result.set(id,{id,homeroom:'',campus:meta.get(id)?.campus||'',notes:[],schedule:emptySchedule()});
    const item=result.get(id);if(clean(row[gi]))item.homeroom=clean(row[gi]);
    if(fold(row[si]).startsWith('ghi chu')){item.notes.push(...clean(row[si]).split(/\r?\n/).filter(Boolean));continue;}
    const mark=fold(row[si]);if(mark==='sang')session='Sáng';else if(mark==='chieu')session='Chiều';
    const p=clean(row[pi]);if(!p)continue;
    if(!/^[1-5]$/.test(p)||!session)throw Error('Sai buổi hoặc tiết trong TKBHocSinh dòng '+(r+1));
    dayCols.forEach((c,day)=>{
      const key=[id,session,p,day].join('|'), val=clean(row[c]);
      if(seen.has(key)&&seen.get(key)!==val)throw Error('Lớp '+id+' có hai dòng khác nhau cho cùng một tiết. Kiểm tra mã lớp dạng văn bản.');
      seen.set(key,val);item.schedule[session][+p-1][day]=lesson(val);
    });
  }
  for(const item of result.values()){
    const annotated=new Set();
    for(const rule of parseWeekNotes(item.notes.join('\n')))for(const p of rule.periods){
      const key=[rule.session,p,rule.day].join('|');if(annotated.has(key))throw Error('Lớp '+item.id+' có ghi chú tuần trùng tiết.');annotated.add(key);
      const cell=item.schedule[rule.session][p-1][rule.day];
      if(cell.length!==1||cell[0].week||cell[0].teacher)throw Error('Ghi chú tuần của lớp '+item.id+' không khớp ô môn học.');
      const subjects=cell[0].subject.split(/\s*\/\s*/).map(clean);
      if(subjects.length!==2||[...subjects].sort().join('|')!==[rule.even,rule.odd].sort().join('|'))throw Error('Môn trong ghi chú tuần của lớp '+item.id+' không khớp ô môn học.');
      item.schedule[rule.session][p-1][rule.day]=[{subject:rule.even,week:2,teacher:'',classId:''},{subject:rule.odd,week:1,teacher:'',classId:''}];
    }
    for(const session of SESSIONS)for(const days of item.schedule[session])for(const cell of days){if(cell.some(l=>l.subject.includes('/')&&!l.week))throw Error('Lớp '+item.id+' có ô môn luân phiên nhưng thiếu ghi chú tuần.');}
  }
  return [...result.values()].sort((a,b)=>natural(a.id,b.id));
}
export function parseDirectory(rows){
  const hi=rows.findIndex(r=>r.map(head).includes('magv')&&r.map(head).includes('hovatengv'));
  if(hi<0)throw Error('DanhMucGiaoVien cần cột MaGV và HoVaTenGV.');
  const h=rows[hi].map(head), col=x=>h.indexOf(x), people=new Map();
  for(const row of rows.slice(hi+1)){
    const alias=clean(row[col('magv')]),name=clean(row[col('hovatengv')]);
    if(!alias&&!name)continue;
    if(!name)throw Error('DanhMucGiaoVien chưa có họ tên đầy đủ cho '+alias+'.');
    const id=identity(name);
    if(!people.has(id))people.set(id,{id,name,aliases:[],departments:[],campuses:[],homerooms:[],schedule:emptySchedule()});
    const item=people.get(id);
    for(const [key,value] of [['aliases',alias],['departments',clean(row[col('tochuyenmon')])],['campuses',clean(row[col('diemtruong')])],['homerooms',classId(row[col('chunhiemlop')])]]){
      if(value&&!item[key].includes(value))item[key].push(value);
    }
  }
  return [...people.values()];
}
export function parseTeachers(rows,directory){
  const people=structuredClone(directory), lookup=new Map();
  people.forEach(p=>[p.name,...p.aliases].forEach(alias=>{
    const id=identity(alias);if(!lookup.has(id))lookup.set(id,[]);lookup.get(id).push(p);
  }));
  let current=null,session='',dayCols=[1,2,3,4,5,6];
  for(let index=0;index<rows.length;index++){
    const row=rows[index], label=clean(row[0]), norm=fold(label);
    if(!label)continue;
    if(norm==='sang'||norm==='chieu'){session=norm==='sang'?'Sáng':'Chiều';continue;}
    if(head(label)==='tiet'){
      dayCols=DAYS.map((d,i)=>row.findIndex(x=>head(x)===head(d)||head(x)==='thu'+(i+2)));
      if(dayCols.some(c=>c<0))throw Error('TKBGiaoVien thiếu cột thứ ở dòng '+(index+1));continue;
    }
    if(/^[1-5]$/.test(label)){
      if(!current||!session)throw Error('TKBGiaoVien thiếu tên giáo viên hoặc buổi ở dòng '+(index+1));
      dayCols.forEach((col,day)=>lesson(row[col],'teacher').forEach(l=>{
        if(!/^\d+\.\d+$/.test(l.classId))throw Error('TKBGiaoVien: ô phải có dạng Môn - Lớp, dòng '+(index+1));
        l.teacher=current.name;const list=current.schedule[session][+label-1][day];
        if(!list.some(v=>v.subject===l.subject&&v.week===l.week&&v.classId===l.classId))list.push(l);
      }));continue;
    }
    if(row.slice(1).some(x=>clean(x)))throw Error('Không nhận ra dòng '+(index+1)+' trong TKBGiaoVien.');
    const candidates=[...new Set(lookup.get(identity(label))||[])];
    if(candidates.length!==1)throw Error('Không ghép được tên '+label+' với DanhMucGiaoVien. Dùng họ tên đầy đủ.');
    current=candidates[0];session='';
  }
  return people.sort((a,b)=>natural(a.name,b.name));
}
export function parseTime(value){
  if(typeof value==='number'){
    const mins=Math.round((value%1)*1440);return String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0');
  }
  const m=clean(value).match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if(!m||+m[1]>23||+m[2]>59)throw Error('Giờ không hợp lệ: '+clean(value));
  return m[1].padStart(2,'0')+':'+m[2];
}
export const minutes = v => +v.slice(0,2)*60 + +v.slice(3,5);
export function parseTimes(rows){
  const hi=rows.findIndex(r=>r.map(head).includes('buoi')&&r.map(head).includes('tiet'));
  if(hi<0)throw Error('ThoiGianBieu thiếu tiêu đề.');
  const h=rows[hi].map(head), cs=h.indexOf('buoi'),cp=h.indexOf('tiet'),startCol=h.findIndex(v=>v.includes('batdau')),endCol=h.findIndex(v=>v.includes('ketthuc'));
  if(startCol<0||endCol<0)throw Error('ThoiGianBieu thiếu giờ bắt đầu/kết thúc.');
  const blocks=[];let session='';
  for(const row of rows.slice(hi+1)){
    const mark=fold(row[cs]);if(mark==='sang')session='Sáng';else if(mark==='chieu')session='Chiều';
    if(!clean(row[startCol])&&!clean(row[endCol]))continue;
    const p=clean(row[cp]),isBreak=/ra choi|giai lao/.test(fold(p));
    if(!session||(!isBreak&&!/^[1-5]$/.test(p)))throw Error('Sai buổi/tiết trong ThoiGianBieu.');
    const start=parseTime(row[startCol]),end=parseTime(row[endCol]);
    if(minutes(end)<=minutes(start))throw Error('Giờ kết thúc phải sau giờ bắt đầu.');
    blocks.push({session,period:isBreak?null:+p,type:isBreak?'break':'period',start,end,startM:minutes(start),endM:minutes(end)});
  }
  blocks.sort((a,b)=>a.startM-b.startM);
  if(blocks.some((b,i)=>i&&b.startM<blocks[i-1].endM))throw Error('ThoiGianBieu có khung giờ chồng nhau.');
  for(const s of SESSIONS)for(let p=1;p<=5;p++)if(blocks.filter(b=>b.session===s&&b.period===p).length!==1)throw Error('ThoiGianBieu thiếu hoặc trùng tiết '+p+' buổi '+s+'.');
  return blocks;
}
export function conflicts(teachers){
  const out=[];
  teachers.forEach(t=>SESSIONS.forEach(s=>t.schedule[s].forEach((days,p)=>days.forEach((list,day)=>{
    for(let a=0;a<list.length;a++)for(let b=a+1;b<list.length;b++){
      if(list[a].classId!==list[b].classId&&(!list[a].week||!list[b].week||list[a].week===list[b].week))out.push({teacher:t.name,session:s,period:p+1,day,lessons:[list[a],list[b]]});
    }
  }))));return out;
}
export function freeTeachers(teachers,{session,period,day,week=0,department='',campus=''}){
  if(!SESSIONS.includes(session)||!Number.isInteger(period)||period<1||period>5||!Number.isInteger(day)||day<0||day>5||![0,1,2].includes(week))throw Error('Thời điểm tìm giáo viên không hợp lệ.');
  return teachers.filter(t=>(!department||t.departments.includes(department))&&(!campus||t.campuses.includes(campus))&&!t.schedule[session][period-1][day].some(l=>active(l,week)));
}
export function clock(date=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
  const iso=parts.year+'-'+parts.month+'-'+parts.day,utc=new Date(iso+'T00:00:00Z');
  return {iso,day:(utc.getUTCDay()+6)%7,minutes:+parts.hour*60 + +parts.minute,time:parts.hour+':'+parts.minute};
}
export function dateWeek(iso,anchor){
  if(!anchor)return null;
  const start=new Date(anchor+'T00:00:00Z'),current=new Date(iso+'T00:00:00Z');
  if(!Number.isFinite(+start)||start.getUTCDay()!==1||!Number.isFinite(+current)||current<start)return null;
  return Math.floor((current-start)/604800000)+1;
}
export function currentBlock(blocks,date=new Date()){const c=clock(date);return c.day===6?null:blocks.find(b=>c.minutes>=b.startM&&c.minutes<b.endM)||null;}
const icsText=v=>String(v).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
function foldIcs(line){let out='',bytes=0;for(const char of line){const n=new TextEncoder().encode(char).length;if(bytes+n>73){out+='\r\n ';bytes=1;}out+=char;bytes+=n;}return out;}
export function calendar(item,blocks,{startDate,weeks=4,firstWeek,anchor=null,kind='student'}){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!Number.isInteger(weeks)||weeks<1||weeks>16)throw Error('Chọn ngày bắt đầu và số tuần từ 1 đến 16.');
  const start=new Date(startDate+'T00:00:00Z');if(start.toISOString().slice(0,10)!==startDate)throw Error('Ngày bắt đầu không hợp lệ.');
  if(dateWeek(startDate,anchor)===null&&![1,2].includes(firstWeek))throw Error('Cần xác định tuần lẻ/chẵn của ngày bắt đầu.');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Hoc lieu so//TKB LHP//VI','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+icsText(kind==='student'?'TKB lớp '+item.id:'TKB '+item.name)];
  const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  for(let n=0;n<weeks*7;n++){
    const dt=new Date(+start+n*86400000),iso=dt.toISOString().slice(0,10),day=(dt.getUTCDay()+6)%7;
    if(day===6)continue;
    const weekNumber=dateWeek(iso,anchor),mondayOffset=(start.getUTCDay()+6)%7;
    const parity=weekNumber!==null?(weekNumber%2?1:2):((Math.floor((n+mondayOffset)/7)+(firstWeek===2?1:0))%2?2:1);
    blocks.filter(b=>b.type==='period').forEach(b=>item.schedule[b.session][b.period-1][day].filter(l=>active(l,parity)).forEach((l,i)=>{
      const value=(time)=>new Date(iso+'T'+time+':00+07:00').toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
      const uid=encodeURIComponent([kind,item.id,b.session,b.period,iso,l.subject,l.classId,l.teacher,i].join('|'))+'@tkb.hoclieuso.id.vn';
      const person=kind==='teacher'?item.name:l.teacher;
      lines.push('BEGIN:VEVENT','UID:'+uid,'DTSTAMP:'+stamp,'DTSTART:'+value(b.start),'DTEND:'+value(b.end),'SUMMARY:'+icsText(l.subject+(kind==='teacher'?' - '+l.classId:'')),'DESCRIPTION:'+icsText((person?'Giáo viên: '+person+'\n':'')+'Tiết '+b.period+' - '+b.session+'\nLịch nhập không tự cập nhật từ Google Sheet.'),'LOCATION:'+icsText(kind==='student'?item.campus:item.campuses.join(' / ')),'END:VEVENT');
    }));
  }
  lines.push('END:VCALENDAR');return lines.map(foldIcs).join('\r\n')+'\r\n';
}

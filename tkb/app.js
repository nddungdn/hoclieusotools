import {CONFIG} from './config.js';
import {AUTH_KEY,REMEMBER_SECONDS,createAuthStore} from './auth.js';
import {countdown} from './countdown.js';
import {fetchTimetable} from './request.js';
import {DAYS,SESSIONS,fold,classId,natural,active,clock,dateWeek,currentBlock,calendar,swipeDay} from './core.js';
const $=id=>document.getElementById(id),KEY='lhp-tkb-v1:',state={mode:'student',public:null,private:null,classId:'',teacherId:'',week:0,day:Math.min(clock().day,5),token:'',install:null,touchX:null,touchY:null,toastTimer:null,requestId:0};
const store={get(k,session=false){try{return(session?sessionStorage:localStorage).getItem(KEY+k)||'';}catch{return'';}},set(k,v,session=false){try{(session?sessionStorage:localStorage).setItem(KEY+k,v);}catch{}},remove(k,session=false){try{(session?sessionStorage:localStorage).removeItem(KEY+k);}catch{}}};
const authStore=createAuthStore();
let lastClockMinute=-1;
function node(tag,text='',cls=''){const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;}
function toast(message){clearTimeout(state.toastTimer);$('toast').textContent=message;$('toast').hidden=false;state.toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
function data(){return state.mode==='teacher'?state.private:state.public;}
function selected(){return state.mode==='teacher'?state.private?.teachers.find(t=>t.id===state.teacherId):state.public?.classes.find(c=>c.id===state.classId);}
function title(item=selected()){return state.mode==='teacher'?item?.name||'':'Lớp '+(item?.id||'').replace('.','/');}
function err(message){$('error-text').textContent=message;$('error').hidden=!message;}
async function api(path,{method='GET',body,auth=false}={}){
  if(!CONFIG.apiUrl)throw Error('Tiện ích chưa kết nối dữ liệu. Nhà trường cần hoàn tất cấu hình.');
  let url;try{url=new URL(CONFIG.apiUrl);}catch{throw Error('Địa chỉ API trong config.js phải bắt đầu bằng https://.');}
  if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash)throw Error('apiUrl cần là URL gốc của Worker, bắt đầu bằng https:// và không kèm /api.');
  const base=url.origin,headers={};if(body)headers['Content-Type']='application/json';if(auth)headers.Authorization='Bearer '+state.token;
  let response;try{response=await fetchTimetable(base+path,{method,headers,body:body?JSON.stringify(body):undefined,credentials:'omit',cache:'no-store'},{onRetry:attempt=>{$('connection').textContent='Kết nối dữ liệu bị gián đoạn · Đang thử lại ('+attempt+'/2)…';}});}catch{throw Error('Không kết nối được dữ liệu. Kiểm tra mạng và thử lại.');}
  let payload;try{payload=await response.json();}catch{throw Error('Máy chủ không trả dữ liệu JSON (HTTP '+response.status+'). Kiểm tra URL Worker trong config.js.');}
  if(auth&&response.status===401)logout(false);
  if(!response.ok||!payload.success)throw Error(payload.message||'Không tải được thời khóa biểu.');
  return payload;
}
function setOptions(id,values,label){const el=$(id),old=el.value;el.replaceChildren();const first=node('option',label);first.value='';el.append(first);values.filter(Boolean).sort(natural).forEach(v=>{const option=node('option',v);option.value=v;el.append(option);});if(values.includes(old))el.value=old;}
async function loadPublic(){
  $('refresh').disabled=true;err('');$('connection').textContent='Đang đồng bộ dữ liệu…';
  try{
    const d=await api('/api/public');if(!Array.isArray(d.classes)||!Array.isArray(d.blocks))throw Error('Dữ liệu chưa đúng mẫu.');state.public=d;
    setOptions('class-campus',[...new Set(d.classes.map(c=>c.campus))],'Tất cả điểm trường');
    const wanted=classId(new URLSearchParams(location.search).get('class')||store.get('class'));
    if(!d.classes.some(c=>c.id===state.classId))state.classId=d.classes.some(c=>c.id===wanted)?wanted:(d.classes[0]?.id||'');
    renderClasses();if(state.mode==='student')render();syncMeta();
  }catch(e){err(e.message);$('connection').textContent='Chưa đồng bộ được dữ liệu.';}finally{$('refresh').disabled=false;tick();}
}
async function loadTeachers(){
  if(!state.token)return;
  const id=++state.requestId;$('connection').textContent='Đang tải lịch giáo viên…';
  try{
    const d=await api('/api/teachers',{auth:true});if(id!==state.requestId||!state.token)return;
    state.private=d;err('');$('login-form').hidden=true;$('teacher-tools').hidden=false;
    const departments=[...new Set(d.teachers.flatMap(t=>t.departments))],campuses=[...new Set(d.teachers.flatMap(t=>t.campuses))];
    setOptions('department',departments,'Tất cả tổ chuyên môn');setOptions('finder-department',departments,'Tất cả tổ');setOptions('teacher-campus',campuses,'Tất cả điểm trường');setOptions('finder-campus',campuses,'Tất cả điểm trường');
    const remembered=authStore.restore()?.teacherId;state.teacherId=d.teachers.some(t=>t.id===state.teacherId)?state.teacherId:d.teachers.some(t=>t.id===remembered)?remembered:d.teachers[0]?.id||'';
    renderTeachers();if(state.mode==='teacher')render();syncMeta();
  }catch(e){err(e.message);if(state.token)$('connection').textContent='Chưa tải được lịch giáo viên.';}
}
function syncMeta(){
  const d=data()||state.public;if(!d)return;
  $('announcement').textContent=d.meta.announcement||'';$('announcement').hidden=!d.meta.announcement;
  const fetched=new Date(d.meta.fetchedAt);$('connection').textContent='Dữ liệu tải lúc '+(Number.isFinite(+fetched)?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(fetched):'vừa xong')+' · Tự kiểm tra mỗi 5 phút';
  $('effective-date').textContent=d.meta.effectiveDate?'Áp dụng từ '+d.meta.effectiveDate.split('-').reverse().join('/'):'Ngày áp dụng: nhà trường đang cập nhật';
  const n=dateWeek(clock().iso,d.meta.week1Start);$('week-note').textContent=n?('Hôm nay: tuần '+n+' ('+(n%2?'lẻ':'chẵn')+')'):'Chọn tuần chẵn/lẻ theo thông báo của nhà trường.';
}
function filteredClasses(){const query=fold(classId($('class-search').value));return(state.public?.classes||[]).filter(c=>(!query||fold(c.id).includes(query))&&(!$('grade').value||c.id.split('.')[0]===$('grade').value)&&(!$('class-campus').value||c.campus===$('class-campus').value));}
function renderClasses(){const list=filteredClasses(),parent=$('class-buttons');parent.replaceChildren();list.forEach(c=>{const button=node('button','Lớp '+c.id.replace('.','/'));button.type='button';button.setAttribute('aria-pressed',String(c.id===state.classId));button.addEventListener('click',()=>selectClass(c.id));parent.append(button);});$('class-count').textContent=list.length?list.length+' lớp':'Không có lớp phù hợp. Thử đổi từ khóa hoặc bộ lọc.';}
function selectClass(id){state.classId=id;store.set('class',id);const url=new URL(location.href);url.searchParams.set('class',id);history.replaceState({},'',url);renderClasses();render();}
function filteredTeachers(){const q=fold($('teacher-search').value);return(state.private?.teachers||[]).filter(t=>(!q||fold([t.name,...t.aliases].join(' ')).includes(q))&&(!$('department').value||t.departments.includes($('department').value))&&(!$('teacher-campus').value||t.campuses.includes($('teacher-campus').value)));}
function renderTeachers(){const list=filteredTeachers(),picker=$('teacher-select');picker.replaceChildren();list.forEach(t=>{const option=node('option',t.name);option.value=t.id;picker.append(option);});if(!list.some(t=>t.id===state.teacherId))state.teacherId=list[0]?.id||'';picker.value=state.teacherId;if(state.teacherId)authStore.selectTeacher(state.teacherId);picker.disabled=!list.length;$('teacher-count').textContent=list.length?list.length+' giáo viên phù hợp':'Không có giáo viên phù hợp. Thử đổi từ khóa hoặc bộ lọc.';}
function displayLessons(list){return list.filter(l=>active(l,state.week));}
function clashing(list){return list.some((a,i)=>list.some((b,j)=>j>i&&a.classId!==b.classId&&(!a.week||!b.week||a.week===b.week)));}
function lessonElement(l){const el=node('div','','lesson');el.append(node('strong',l.subject+(state.mode==='teacher'?' · '+l.classId.replace('.','/'):'')));if(l.week&&state.mode==='teacher')el.append(node('span','Tuần '+(l.week===1?'lẻ':'chẵn'),'week-label'));return el;}
function appendLessons(parent,list){if(state.mode==='student'&&list.length>1)parent.append(lessonElement({subject:list.map(l=>l.subject).join(' / ')}));else list.forEach(l=>parent.append(lessonElement(l)));}
function render(){
  const item=selected();$('schedule').hidden=!item;if(!item){tick();return;}
  $('schedule-title').textContent=(state.mode==='teacher'?'THỜI KHÓA BIỂU GIÁO VIÊN':'THỜI KHÓA BIỂU HỌC SINH')+' — '+title(item);
  const meta=$('schedule-meta');meta.replaceChildren();
  if(state.mode==='student'){meta.append(node('span','GVCN: '+(item.homeroom||'Đang cập nhật'),'meta-chip'));if(item.campus)meta.append(node('span',item.campus,'meta-chip campus'));}
  else{meta.append(node('span',item.departments.join(' / ')||'Chưa có tổ chuyên môn','meta-chip'));meta.append(node('span',item.campuses.join(' / '),'meta-chip campus'));if(item.homerooms.length)meta.append(node('span','Chủ nhiệm: '+item.homerooms.map(v=>v.replace('.','/')).join(', '),'meta-chip'));}
  const issues=(state.private?.conflicts||[]).filter(c=>c.teacher===item.name&&c.lessons.every(l=>active(l,state.week)));
  $('conflict-warning').replaceChildren();$('conflict-warning').hidden=state.mode!=='teacher'||!issues.length;
  if(issues.length){$('conflict-warning').append(node('strong','Nguồn có '+issues.length+' tiết trùng giờ cần xác nhận:'));issues.forEach(c=>$('conflict-warning').append(node('p',DAYS[c.day]+', '+c.session.toLowerCase()+', tiết '+c.period+': '+c.lessons.map(l=>l.classId.replace('.','/')).join(' và '))));}
  renderDesktop(item);renderMobile(item);const notes=$('schedule-notes');notes.replaceChildren();if(state.mode==='student')(item.notes||[]).forEach(text=>notes.append(node('p',text)));notes.hidden=state.mode!=='student'||!(item.notes||[]).length;syncMeta();tick();
}
function visibleDays(item){return item.schedule.Sáng.some(p=>p[5].length)||item.schedule.Chiều.some(p=>p[5].length)?6:5;}
function renderDesktop(item){
  const table=node('table'),caption=node('caption',title(item),'sr-only');table.append(caption);const thead=node('thead'),tr=node('tr'),today=clock().day,count=visibleDays(item);
  for(const [text,cls] of [['Buổi','session-col'],['Tiết','period-col'],['Giờ','time-col']]){const h=node('th',text,cls);h.scope='col';tr.append(h);}
  for(let day=0;day<count;day++){const h=node('th',DAYS[day],day===today?'today-head':'');h.scope='col';if(day===today)h.append(node('span','HÔM NAY','today-badge'));tr.append(h);}
  thead.append(tr);table.append(thead);const body=node('tbody');
  SESSIONS.forEach(s=>{for(let p=1;p<=5;p++){
    const row=node('tr');if(p===1){const session=node('td',s.toUpperCase(),'session');session.rowSpan=5;row.append(session);}row.append(node('td',String(p),'period'));
    const block=data().blocks.find(b=>b.session===s&&b.period===p);row.append(node('td',block?block.start+'–'+block.end:'','time'));
    for(let day=0;day<count;day++){
      const lessons=displayLessons(item.schedule[s][p-1][day]),cell=node('td','',day===today?'today-col':'');cell.dataset.cell=[s,p,day].join('|');
      if(state.mode==='teacher'&&clashing(lessons))cell.classList.add('conflict-cell');appendLessons(cell,lessons);row.append(cell);
    }body.append(row);
  }});table.append(body);$('desktop-table').replaceChildren(table);
}
function renderMobile(item=selected()){
  if(!item)return;const today=clock().day;$('day-title').textContent=DAYS[state.day]+(state.day===today?' · Hôm nay':'');$('day-buttons').replaceChildren();
  DAYS.forEach((d,i)=>{const button=node('button','T'+(i+2));button.type='button';button.setAttribute('aria-label',d);button.setAttribute('aria-pressed',String(i===state.day));button.addEventListener('click',()=>{state.day=i;renderMobile();tick();});$('day-buttons').append(button);});
  const parent=$('mobile-list');parent.replaceChildren();SESSIONS.forEach(s=>{parent.append(node('h3',s.toUpperCase(),'mobile-session-title'));for(let p=1;p<=5;p++){
    const row=node('div','','mobile-row');row.dataset.cell=[s,p,state.day].join('|');const period=node('div','Tiết '+p,'mobile-period'),block=data().blocks.find(b=>b.session===s&&b.period===p);
    if(block)period.append(node('small',block.start+'\n'+block.end));const content=node('div','','mobile-lessons'),lessons=displayLessons(item.schedule[s][p-1][state.day]);
    if(state.mode==='teacher'&&clashing(lessons))row.classList.add('conflict-cell');if(lessons.length)appendLessons(content,lessons);else content.append(node('span','Không có tiết','empty-lesson'));row.append(period,content);parent.append(row);
  }});
}
function updateCountdown(now=new Date()){
  const el=$('live-countdown');if(!el)return;
  const result=countdown((data()||state.public)?.blocks||[],now);el.hidden=!result;
  el.textContent=result?'Còn '+result.text:'';
  if(result)el.setAttribute('aria-label',(result.block.type==='break'?'Ra chơi':'Tiết '+result.block.period)+' còn '+result.text);
}
function updateLiveClock(){
  if(state.token&&!authStore.restore()){logout(false);return;}
  const now=new Date();if(Math.floor(+now/60000)!==lastClockMinute)tick();else updateCountdown(now);
}
function tick(){
  if(state.token&&!authStore.restore()){logout(false);return;}
  const now=new Date(),c=clock(now);lastClockMinute=Math.floor(+now/60000);updateCountdown(now);$('live-time').textContent=(c.day<6?DAYS[c.day]:'Chủ nhật')+' · '+c.iso.split('-').reverse().join('/')+' · '+c.time;
  document.querySelectorAll('.live-cell').forEach(e=>e.classList.remove('live-cell'));
  const d=data()||state.public,item=selected();if(!d){$('live-status').textContent='Chưa có dữ liệu thời khóa biểu';return;}
  if(c.day===6){$('live-status').textContent='Hôm nay là Chủ nhật';return;}
  const b=currentBlock(d.blocks,now);if(b){
    if(b.type==='break'){$('live-status').textContent='Đang ra chơi · Buổi '+b.session.toLowerCase()+' · '+b.start+'–'+b.end;return;}
    let detail='';if(item){const ls=displayLessons(item.schedule[b.session][b.period-1][c.day]);detail=ls.length?' · '+ls.map(l=>l.subject).join(' / '):' · Không có tiết trong lịch đang xem';}
    $('live-status').textContent='Đang học tiết '+b.period+' · Buổi '+b.session.toLowerCase()+detail;
    document.querySelectorAll('[data-cell]').forEach(e=>{if(e.dataset.cell===[b.session,b.period,c.day].join('|'))e.classList.add('live-cell');});
  }else{const next=d.blocks.find(b=>b.startM>c.minutes);$('live-status').textContent=next?'Sắp tới: '+(next.type==='break'?'Ra chơi':'Tiết '+next.period)+' buổi '+next.session.toLowerCase()+' · '+next.start:'Đã kết thúc tất cả tiết học trong ngày.';}
}
async function switchMode(mode){state.mode=mode;$('tab-student').setAttribute('aria-selected',String(mode==='student'));$('tab-teacher').setAttribute('aria-selected',String(mode==='teacher'));$('panel-student').hidden=mode!=='student';$('panel-teacher').hidden=mode!=='teacher';err('');if(mode==='teacher'&&state.token&&!state.private)await loadTeachers();render();syncMeta();}
function logout(showToast=true){state.token='';state.private=null;state.teacherId='';state.requestId++;authStore.clear();$('teacher-tools').hidden=true;$('login-form').hidden=false;$('password').value='';$('teacher-select').replaceChildren();$('finder-results').replaceChildren();$('conflict-warning').replaceChildren();document.querySelectorAll('dialog[open]').forEach(d=>d.close());if(state.mode==='teacher'){$('schedule').hidden=true;$('desktop-table').replaceChildren();$('mobile-list').replaceChildren();$('schedule-meta').replaceChildren();$('schedule-notes').replaceChildren();$('schedule-notes').hidden=true;$('schedule-title').textContent='THỜI KHÓA BIỂU';}syncMeta();tick();if(showToast)toast('Đã đăng xuất.');}
async function login(e){e.preventDefault();$('login-submit').disabled=true;$('login-error').textContent='';try{const remember=$('remember-login').checked,r=await api('/api/login',{method:'POST',body:{username:$('username').value,password:$('password').value,remember}});const saved=authStore.save(r.token,r.expiresIn,remember);state.token=r.token;$('password').value='';err('');await loadTeachers();if(remember&&!saved)toast('Trình duyệt chặn lưu đăng nhập. Phiên này chỉ được giữ khi trình duyệt cho phép.');else if(remember&&r.expiresIn<REMEMBER_SECONDS)toast('Máy chủ vẫn dùng phiên 8 giờ. Cần cập nhật Worker để nhớ đăng nhập 30 ngày.');}catch(error){$('login-error').textContent=error.message;}finally{$('login-submit').disabled=false;}}
function download(blob,name){const url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function exportCalendar(e){e.preventDefault();try{const item=selected();if(!item)throw Error('Vui lòng chọn lịch.');const text=calendar(item,data().blocks,{startDate:$('calendar-start').value,weeks:+$('calendar-weeks').value,firstWeek:+$('calendar-parity').value,anchor:data().meta.week1Start||null,kind:state.mode});download(new Blob([text],{type:'text/calendar;charset=utf-8'}),'TKB_LHP_'+(state.mode==='teacher'?item.name:item.id)+'.ics');$('calendar-dialog').close();toast('Đã tạo file lịch.');}catch(error){toast(error.message);}}
function drawWrapped(ctx,text,x,y,width,lineHeight){const words=text.split(/\s+/),lines=[];let line='';for(const word of words){const candidate=line?line+' '+word:word;if(ctx.measureText(candidate).width>width&&line){lines.push(line);line=word;}else line=candidate;}lines.push(line);lines.forEach((v,i)=>ctx.fillText(v,x,y+i*lineHeight));return lines.length;}
async function exportImage(){
  const item=selected();if(!item)return;$('image').disabled=true;
  try{
    const count=visibleDays(item),width=1500,left=150,colW=(width-60-left)/count,rows=[];
    const measure=document.createElement('canvas').getContext('2d');measure.font='15px Arial';
    SESSIONS.forEach(s=>{for(let p=1;p<=5;p++){const columns=Array.from({length:count},(_,day)=>state.mode==='student'?displayLessons(item.schedule[s][p-1][day]).map(l=>l.subject).join(' / '):displayLessons(item.schedule[s][p-1][day]).map(l=>l.subject+(l.week?' (Tuần '+(l.week===1?'lẻ':'chẵn')+')':'')+'\nLớp '+l.classId.replace('.','/')).join('\n\n'));let max=1;columns.forEach(text=>{let n=0;for(const part of text.split('\n')){let line='';for(const word of part.split(/\s+/)){if(measure.measureText(line+' '+word).width>colW-18&&line){n++;line=word;}else line+=(line?' ':'')+word;}n++;}max=Math.max(max,n);});rows.push({s,p,columns,height:Math.max(54,22*max+18)});}});
    const imageNotes=state.mode==='student'?(item.notes||[]):[],height=235+rows.reduce((sum,r)=>sum+r.height,0)+imageNotes.length*44,canvas=document.createElement('canvas');canvas.width=width*1.5;canvas.height=height*1.5;const ctx=canvas.getContext('2d');ctx.scale(1.5,1.5);ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.textBaseline='top';ctx.textAlign='center';ctx.fillStyle='#0750b8';ctx.fillRect(0,0,width,95);ctx.fillStyle='#fff';ctx.font='bold 25px Arial';ctx.fillText(CONFIG.schoolName,width/2,18);ctx.font='bold 21px Arial';ctx.fillText('THỜI KHÓA BIỂU — '+title(item),width/2,53);ctx.fillStyle='#566275';ctx.font='15px Arial';ctx.fillText(state.mode==='student'?'GVCN: '+item.homeroom+' · '+item.campus:item.departments.join(' / ')+' · '+item.campuses.join(' / '),width/2,109);ctx.fillText((state.week?'Tuần '+(state.week===1?'lẻ':'chẵn'):'Tất cả tuần')+' · '+$('effective-date').textContent,width/2,135);
    let y=166;ctx.fillStyle='#7907b6';ctx.fillRect(30,y,width-60,38);ctx.fillStyle='white';ctx.font='bold 15px Arial';ctx.fillText('Buổi / Tiết',30+left/2,y+10);for(let day=0;day<count;day++)ctx.fillText(DAYS[day],30+left+colW*(day+.5),y+10);y+=38;ctx.textAlign='left';
    for(const row of rows){ctx.fillStyle=row.s==='Sáng'?'#fafbfe':'#f1f6fc';ctx.fillRect(30,y,width-60,row.height);ctx.strokeStyle='#dce3ed';ctx.strokeRect(30,y,width-60,row.height);ctx.fillStyle='#ed2794';ctx.font='bold 15px Arial';ctx.fillText(row.s+' · Tiết '+row.p,40,y+12);const b=data().blocks.find(b=>b.session===row.s&&b.period===row.p);ctx.font='12px Arial';ctx.fillStyle='#667085';ctx.fillText(b.start+'–'+b.end,40,y+34);row.columns.forEach((text,day)=>{const x=30+left+colW*day;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+row.height);ctx.stroke();ctx.fillStyle='#263145';ctx.font='15px Arial';let cy=y+10;for(const paragraph of text.split('\n'))cy+=drawWrapped(ctx,paragraph,x+9,cy,colW-18,22)*22;});y+=row.height;}
    if(imageNotes.length){ctx.textAlign='left';ctx.font='15px Arial';ctx.fillStyle='#334155';for(const text of imageNotes){y+=10;y+=drawWrapped(ctx,text,40,y,width-80,22)*22;}}ctx.textAlign='center';ctx.font='12px Arial';ctx.fillStyle='#667085';ctx.fillText('Học liệu số · tools.hoclieuso.id.vn/tkb · Lịch lưu không tự cập nhật',width/2,y+14);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error();download(blob,'TKB_LHP_'+(state.mode==='teacher'?item.name:item.id)+'.png');
  }catch{toast('Không tạo được ảnh. Thầy/cô có thể dùng nút In.');}finally{$('image').disabled=false;}
}
async function findFree(e){e.preventDefault();const requestId=state.requestId;$('finder-submit').disabled=true;$('finder-results').replaceChildren();try{const r=await api('/api/free-teachers',{method:'POST',auth:true,body:{session:$('finder-session').value,day:+$('finder-day').value,period:+$('finder-period').value,week:+$('finder-week').value,department:$('finder-department').value,campus:$('finder-campus').value}});if(!state.token||requestId!==state.requestId)return;$('finder-results').append(node('p',r.teachers.length+' giáo viên trống tiết theo tiêu chí đã chọn.'));r.teachers.forEach(t=>{const row=node('div','','finder-result'),info=node('div',t.name);info.append(node('small',t.departments.join(' / ')+' · '+t.campuses.join(' / ')));const button=node('button','Xem TKB','action neutral');button.type='button';button.addEventListener('click',()=>{$('teacher-search').value='';$('department').value='';$('teacher-campus').value='';state.teacherId=t.id;renderTeachers();render();$('finder-dialog').close();});row.append(info,button);$('finder-results').append(row);});}catch(error){$('finder-results').append(node('p',error.message));}finally{$('finder-submit').disabled=false;}}
function setup(){
  $('school-name').textContent=CONFIG.schoolName;$('authority').textContent=CONFIG.authority;
  const homeLink=$('home-link'),schoolLink=$('school-link');if(homeLink)homeLink.href=CONFIG.homeUrl;if(schoolLink)schoolLink.href=CONFIG.schoolUrl;
  const restored=authStore.restore();state.token=restored?.token||'';state.teacherId=restored?.teacherId||'';document.documentElement.classList.toggle('dark-mode',store.get('theme')==='dark');updateTheme();
  $('tab-student').onclick=()=>switchMode('student');$('tab-teacher').onclick=()=>switchMode('teacher');
  for(const id of ['class-search','grade','class-campus'])$(id).addEventListener(id==='class-search'?'input':'change',renderClasses);
  $('class-search-form').onsubmit=e=>{e.preventDefault();const list=filteredClasses(),exact=list.find(c=>c.id===classId($('class-search').value));if(list.length)selectClass((exact||list[0]).id);else toast('Không tìm thấy lớp.');};
  for(const id of ['teacher-search','department','teacher-campus'])$(id).addEventListener(id==='teacher-search'?'input':'change',()=>{renderTeachers();render();});
  $('teacher-search-form').onsubmit=e=>{e.preventDefault();renderTeachers();render();if(!filteredTeachers().length)toast('Không tìm thấy giáo viên.');};
  $('teacher-select').onchange=()=>{state.teacherId=$('teacher-select').value;authStore.selectTeacher(state.teacherId);render();};
  $('login-form').onsubmit=login;$('logout').onclick=()=>logout();$('show-password').onclick=()=>{const visible=$('password').type==='password';$('password').type=visible?'text':'password';$('show-password').setAttribute('aria-pressed',String(visible));$('show-password').setAttribute('aria-label',visible?'Ẩn mật khẩu':'Hiện mật khẩu');};
  $('week-filter').onchange=()=>{state.week=+$('week-filter').value;render();};$('refresh').onclick=async()=>{if(state.mode==='teacher'&&state.token)await loadTeachers();else await loadPublic();};$('retry').onclick=()=>$('refresh').click();
  $('previous-day').onclick=()=>{state.day=(state.day+5)%6;renderMobile();tick();};$('next-day').onclick=()=>{state.day=(state.day+1)%6;renderMobile();tick();};
  $('mobile-list').addEventListener('touchstart',e=>{state.touchX=e.changedTouches[0].clientX;state.touchY=e.changedTouches[0].clientY;},{passive:true});$('mobile-list').addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-state.touchX,dy=e.changedTouches[0].clientY-state.touchY,next=swipeDay(state.day,dx,dy);if(state.touchX!==null&&next!==state.day){state.day=next;renderMobile();tick();}state.touchX=null;state.touchY=null;},{passive:true});
  $('theme').onclick=()=>{const dark=document.documentElement.classList.toggle('dark-mode');store.set('theme',dark?'dark':'light');updateTheme();};
  $('print').onclick=()=>window.print();$('image').onclick=exportImage;
  $('calendar').onclick=()=>{$('calendar-start').value=clock().iso;const n=dateWeek(clock().iso,data().meta.week1Start);$('calendar-parity').disabled=!!n;$('calendar-parity').value=n?(n%2?'1':'2'):(state.week?String(state.week):'');$('calendar-dialog').showModal();};
  $('calendar-start').onchange=()=>{const n=dateWeek($('calendar-start').value,data().meta.week1Start);$('calendar-parity').disabled=!!n;if(n)$('calendar-parity').value=n%2?'1':'2';};$('calendar-form').onsubmit=exportCalendar;
  DAYS.forEach((d,i)=>{const o=node('option',d);o.value=String(i);$('finder-day').append(o);});$('open-finder').onclick=()=>{$('finder-day').value=String(state.day);$('finder-week').value=String(state.week);$('finder-dialog').showModal();};$('finder-form').onsubmit=findFree;
  document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>$(button.dataset.close).close());
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.install=e;});$('install').onclick=async()=>{if(state.install){await state.install.prompt();state.install=null;}else $('install-dialog').showModal();};
  window.addEventListener('storage',e=>{if(!state.token||(e.key!==AUTH_KEY&&e.key!==null))return;if(e.newValue===null)logout(false);else{const restored=authStore.refresh();if(restored)state.token=restored.token;else logout(false);}});
  if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
  loadPublic();tick();setInterval(updateLiveClock,1000);setInterval(async()=>{if(document.hidden)return;await loadPublic();if(state.mode==='teacher'&&state.token)await loadTeachers();},Math.max(60,CONFIG.refreshSeconds||300)*1000);
}
function updateTheme(){const dark=document.documentElement.classList.contains('dark-mode');$('theme').textContent=dark?'☀ Giao diện sáng':'◐ Giao diện tối';$('theme').setAttribute('aria-pressed',String(dark));}
setup();

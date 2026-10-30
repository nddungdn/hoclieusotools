// Shared, runtime-independent history rules. No credentials or source URLs.
const versionText=v=>String(v??'').trim();
const versionHead=v=>versionText(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().replace(/[^a-z0-9]/g,'');
export const validVersionId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(v);
const normalizedVersionId=v=>/^\d{1,2}$/.test(versionText(v))?versionText(v).padStart(2,'0'):versionText(v);
export function versionDate(value){
 const text=versionText(value);if(!text)return '';
 let iso=text;
 const local=text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
 if(local)iso=local[3]+'-'+local[2].padStart(2,'0')+'-'+local[1].padStart(2,'0');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))throw Error('VERSION_DATE');
 const date=new Date(iso+'T00:00:00Z');if(!Number.isFinite(+date)||date.toISOString().slice(0,10)!==iso)throw Error('VERSION_DATE');return iso;
}
export function parseVersionCatalog(rows){
 if(!Array.isArray(rows)||!rows.length)throw Error('VERSION_CATALOG');
 const h=rows[0].map(versionHead),col=x=>x==='matkb'&&!h.includes(x)?h.indexOf('lantkb'):h.indexOf(x);
 if(['matkb','namhoc','tentkb','trangthai'].some(x=>col(x)<0))throw Error('VERSION_CATALOG');
 const versions=[],seen=new Set(),statuses={hienhanh:'current',luutru:'archive',duthao:'draft'};
 for(const row of rows.slice(1)){
  if(!row.some(v=>versionText(v)))continue;
  const id=normalizedVersionId(row[col('matkb')]),year=versionText(row[col('namhoc')]),name=versionText(row[col('tentkb')]),status=statuses[versionHead(row[col('trangthai')])];
  if(!validVersionId(id)||seen.has(id)||!/^\d{4}-\d{4}$/.test(year)||+year.slice(5)!==+year.slice(0,4)+1||!name||!status)throw Error('VERSION_CATALOG');
  const startDate=versionDate(row[col('tungay')]),endDate=versionDate(row[col('denngay')]);
  if(startDate&&endDate&&endDate<startDate)throw Error('VERSION_DATE');
  seen.add(id);versions.push({id,year,name,status,startDate,endDate});
 }
 if(versions.filter(v=>v.status==='current').length!==1)throw Error('VERSION_ACTIVE');
 return versions;
}
export function selectVersion(versions,requested=''){
 const id=requested==='legacy'?'':normalizedVersionId(requested);
 const found=id?versions.find(v=>v.id===id&&v.status!=='draft'):versions.find(v=>v.status==='current');
 if(!found)throw Error('VERSION_NOT_AVAILABLE');return found;
}
export function versionRows(rows,id,sheetName=''){
 if(!Array.isArray(rows)||!rows.length)throw Error('VERSION_DATA');
 const column=rows[0].map(versionHead).indexOf('matkb');if(column<0)throw Error('VERSION_COLUMN');
 const strip=row=>row.filter((v,i)=>i!==column),selected=[strip(rows[0])];
 for(const row of rows.slice(1)){
  const code=versionText(row[column]);
  if(!code&&strip(row).some(v=>versionText(v)))throw Error('VERSION_ROW_ID');
  if(code===id)selected.push(strip(row));
 }
 if(selected.length===1)throw Error('VERSION_DATA');return selected;
}
export function legacyVersion(meta={}){return {id:'legacy',year:meta.schoolYear||'',name:'TKB Lần 1',status:'current',startDate:meta.effectiveDate||'',endDate:''};}
export function viewingCurrent(payload,iso){
 const v=payload?.selectedVersion;if(!v)return true;
 return v.id===payload.activeVersionId&&v.status==='current'&&(!v.startDate||iso>=v.startDate)&&(!v.endDate||iso<=v.endDate);
}
export function versionLabel(v){return v?v.name+(v.year?' · '+v.year:'')+(v.status==='archive'?' · Lưu trữ':''):'';}
export function timetableSheets(id){
 const suffix=normalizedVersionId(id);if(!validVersionId(suffix))throw Error('VERSION_CATALOG');return {student:'TKBHS'+suffix,teacher:'TKBGV'+suffix};
}
function snapshotRegion(grid,start,width){
 const rows=grid.map(r=>Array.from({length:width},(_,i)=>r[start+i]??''));while(rows.length&&!rows[rows.length-1].some(v=>versionText(v)))rows.pop();return rows;
}
export function sheetSnapshot(studentGrid,teacherGrid=null){
 const studentRows=snapshotRegion(studentGrid,0,12),timeRows=snapshotRegion(studentGrid,13,4);
 if(!studentRows[0]?.map(versionHead).includes('lop'))throw Error('SHEET_STUDENT_LAYOUT');
 if(!timeRows[0]?.map(versionHead).includes('buoi')||!timeRows[0]?.map(versionHead).some(v=>v.includes('batdau')))throw Error('SHEET_TIME_LAYOUT');
 const h=studentRows[0].map(versionHead),ci=h.indexOf('lop'),campus=h.indexOf('diemtruong');
 const classMeta=studentRows.slice(1).filter(r=>/^\d+[./]\d+$/.test(versionText(r[ci]))).map(r=>({classId:versionText(r[ci]).replace(/\//g,'.'),campus:campus>=0?versionText(r[campus]):''}));
 const result={studentRows,timeRows,classMeta};
 if(teacherGrid){
  const teacherRows=snapshotRegion(teacherGrid,0,7),directoryRows=snapshotRegion(teacherGrid,8,5);
  if(!directoryRows[0]?.map(versionHead).includes('magv')||!directoryRows[0]?.map(versionHead).includes('hovatengv'))throw Error('SHEET_DIRECTORY_LAYOUT');
  if(!teacherRows.length)throw Error('VERSION_DATA');Object.assign(result,{teacherRows,directoryRows});
 }return result;
}

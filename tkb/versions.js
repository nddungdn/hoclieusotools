// Shared, runtime-independent history rules. No credentials or source URLs.
const versionText=v=>String(v??'').trim();
const versionHead=v=>versionText(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().replace(/[^a-z0-9]/g,'');
export const validVersionId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(v);
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
 const h=rows[0].map(versionHead),col=x=>h.indexOf(x);
 if(['matkb','namhoc','tentkb','trangthai'].some(x=>col(x)<0))throw Error('VERSION_CATALOG');
 const versions=[],seen=new Set(),statuses={hienhanh:'current',luutru:'archive',duthao:'draft'};
 for(const row of rows.slice(1)){
  if(!row.some(v=>versionText(v)))continue;
  const id=versionText(row[col('matkb')]),year=versionText(row[col('namhoc')]),name=versionText(row[col('tentkb')]),status=statuses[versionHead(row[col('trangthai')])];
  if(!validVersionId(id)||seen.has(id)||!/^\d{4}-\d{4}$/.test(year)||+year.slice(5)!==+year.slice(0,4)+1||!name||!status)throw Error('VERSION_CATALOG');
  const startDate=versionDate(row[col('tungay')]),endDate=versionDate(row[col('denngay')]);
  if(startDate&&endDate&&endDate<startDate)throw Error('VERSION_DATE');
  seen.add(id);versions.push({id,year,name,status,startDate,endDate});
 }
 if(versions.filter(v=>v.status==='current').length!==1)throw Error('VERSION_ACTIVE');
 return versions;
}
export function selectVersion(versions,requested=''){
 const id=requested==='legacy'?'':requested;
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

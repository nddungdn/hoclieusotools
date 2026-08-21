import { buildDocumentModel } from './document-model.js';

const mm = v => Math.round(v * 56.6929133858);

export async function exportDocx(state){
  if (!window.docx) throw new Error('Không tải được thư viện tạo DOCX.');
  const D=window.docx;
  const model=buildDocumentModel(state);
  const sections=model.sections.map(section => ({
    properties:{
      titlePage:true,
      page:{
        size:{ orientation: section.orientation==='landscape' ? D.PageOrientation.LANDSCAPE : D.PageOrientation.PORTRAIT },
        margin:{ top:mm(20), bottom:mm(20), left:mm(30), right:mm(20), header:mm(10), footer:mm(10) }
      }
    },
    headers:{
      default:new D.Header({children:[new D.Paragraph({alignment:D.AlignmentType.CENTER,children:[new D.TextRun({font:'Times New Roman',size:20,children:[D.PageNumber.CURRENT]})]})]}),
      first:new D.Header({children:[new D.Paragraph('')]})
    },
    children:renderBlocks(D,section.blocks)
  }));
  const doc=new D.Document({
    styles:{ default:{ document:{ run:{ font:'Times New Roman', size:26 }, paragraph:{ spacing:{ after:120, line:240 }, alignment:D.AlignmentType.JUSTIFIED } } } },
    sections
  });
  const blob=await D.Packer.toBlob(doc);
  downloadBlob(blob,`KHDH-NguVan${state.project.grade}-${state.project.academicYear}.docx`);
}

function renderBlocks(D,blocks){
  const out=[];
  for(const b of blocks){
    if(b.type==='twoColumnHeader') out.push(twoColumnHeader(D,b));
    else if(b.type==='title') out.push(p(D,b.text,{bold:true,size:28,align:'center',before:180,after:120}));
    else if(b.type==='subtitle') out.push(p(D,b.text,{bold:false,size:26,align:'center',after:100}));
    else if(b.type==='heading') out.push(p(D,b.text,{bold:true,size:26,align:'left',before:160,after:80}));
    else if(b.type==='subheading') out.push(p(D,b.text,{bold:true,size:26,align:'center',before:140,after:80}));
    else if(b.type==='paragraph') out.push(p(D,b.text,{size:26,align:'justify',after:120,firstLine:mm(10)}));
    else if(b.type==='table') out.push(table(D,b.headers,b.rows,b.widths));
    else if(b.type==='signature') out.push(signature(D,b));
  }
  return out;
}

function p(D,text,opt={}){
  const alignMap={center:D.AlignmentType.CENTER,left:D.AlignmentType.LEFT,right:D.AlignmentType.RIGHT,justify:D.AlignmentType.JUSTIFIED};
  return new D.Paragraph({
    alignment:alignMap[opt.align||'justify'],
    spacing:{before:opt.before||0,after:opt.after??120,line:240},
    indent:opt.firstLine?{firstLine:opt.firstLine}:undefined,
    children:[new D.TextRun({text:String(text??''),font:'Times New Roman',size:opt.size||26,bold:!!opt.bold})]
  });
}

function twoColumnHeader(D,b){
  return new D.Table({
    width:{size:100,type:D.WidthType.PERCENTAGE},
    borders:noBorders(D),
    rows:[new D.TableRow({children:[
      new D.TableCell({width:{size:48,type:D.WidthType.PERCENTAGE},borders:noBorders(D),children:String(b.left||'').split('\n').map((x,i)=>p(D,x,{align:'center',bold:i===0,size:24,after:20}))}),
      new D.TableCell({width:{size:52,type:D.WidthType.PERCENTAGE},borders:noBorders(D),children:String(b.right||'').split('\n').map((x,i)=>p(D,x,{align:'center',bold:i===0,size:24,after:20}))})
    ]})]
  });
}

function table(D,headers,rows,widths=[]){
  const all=[headers,...(rows&&rows.length?rows:[Array(headers.length).fill('')])];
  const useWidths=Array.isArray(widths)&&widths.length===headers.length;
  const compact=headers.length>=8;
  const tableWidth=compact?13200:14000;
  const columnWidths=useWidths?widths.map(value=>Math.round(tableWidth*Number(value)/100)):undefined;
  return new D.Table({
    width:{size:tableWidth,type:D.WidthType.DXA},
    columnWidths,
    layout:D.TableLayoutType.FIXED,
    borders:tableBorders(D),
    rows:all.map((row,ri)=>new D.TableRow({
      tableHeader:ri===0,
      cantSplit:true,
      children:headers.map((_,ci)=>new D.TableCell({
        width:useWidths?{size:columnWidths[ci],type:D.WidthType.DXA}:undefined,
        borders:tableBorders(D),
        margins:compact?{top:60,bottom:60,left:45,right:45}:{top:80,bottom:80,left:80,right:80},
        children:String(row[ci]??'').split('\n').map(t=>p(D,t,{align:ri===0?'center':'left',bold:ri===0,size:compact?20:22,after:20}))
      }))
    }))
  });
}

function tableBorders(D){
  const line={style:D.BorderStyle.SINGLE,size:8,color:'000000'};
  return {top:line,bottom:line,left:line,right:line,insideHorizontal:line,insideVertical:line};
}

function signature(D,b){
  return new D.Table({
    width:{size:100,type:D.WidthType.PERCENTAGE},
    borders:noBorders(D),
    rows:[new D.TableRow({children:[
      new D.TableCell({borders:noBorders(D),children:[p(D,b.left,{align:'center',bold:true,size:24}),p(D,'(Ký và ghi rõ họ tên)',{align:'center',size:22})]}),
      new D.TableCell({borders:noBorders(D),children:[p(D,`${b.locality}, ngày ..... tháng ..... năm .....`,{align:'center',size:22}),p(D,b.right,{align:'center',bold:true,size:24}),p(D,'(Ký và ghi rõ họ tên)',{align:'center',size:22})]})
    ]})]
  });
}

function noBorders(D){
  const x={style:D.BorderStyle.NONE,size:0,color:'FFFFFF'};
  return {top:x,bottom:x,left:x,right:x,insideHorizontal:x,insideVertical:x};
}

function downloadBlob(blob,name){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1500);
}

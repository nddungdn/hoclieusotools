/* V1.7.5: giữ thiết lập/ma trận/đặc tả/ngữ liệu, nhưng xóa đề và tiến trình cũ một lần
   vì V1.7.5 siết câu dẫn phần Đọc, khoanh vùng câu tiếng Việt và kiểm tra điểm trước khi gọi AI. */
(()=>{
  const DRAFT='radenguvan_v1_7_1_draft';
  const MARK='radenguvan_v1_7_5_draft_migrated';
  try{
    if(localStorage.getItem(MARK)!=='1'){
      const raw=localStorage.getItem(DRAFT);
      if(raw){
        const d=JSON.parse(raw);
        if(d&&typeof d==='object'){
          d.exam=null;
          d.generation=null;
          d.savedAt=Date.now();
          localStorage.setItem(DRAFT,JSON.stringify(d));
        }
      }
      localStorage.setItem(MARK,'1');
    }
  }catch{}
})();

window.APP_CONFIG={
  API_BASE:'https://radenguvan-secure-api.nddungdn.workers.dev',
  GEMINI_GUIDE_URL:'https://www.hoclieuso.id.vn/2026/06/cach-tao-api-key-google-ai-studio.html',
  APP_VERSION:'1.7.5'
};

/* index.html tải config.js trước data.js/app.js. V1.7.4 giữ phần tách thể loại + UI mode/focus;
   V1.7.5 bổ sung kiểm tra ma trận, câu dẫn Đọc và cách hiển thị GEO_BLOCK. */
if(document.readyState==='loading'&&!window.__RADENGUVAN_V175_PATCH_LOADING__){
  window.__RADENGUVAN_V175_PATCH_LOADING__=true;
  document.write('<script src="v174-patch.js?v=1.7.5"><\/script>');
  document.write('<script src="v175-patch.js?v=1.7.5"><\/script>');
}

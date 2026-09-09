/* V1.7.4: giữ thiết lập/ma trận/đặc tả/ngữ liệu, nhưng xóa đề và tiến trình cũ một lần
   vì V1.7.4 thay đổi quy tắc Truyện ngắn/Truyện lịch sử, Thực hành tiếng Việt và khóa đặc tả. */
(()=>{
  const DRAFT='radenguvan_v1_7_1_draft';
  const MARK='radenguvan_v1_7_4_draft_migrated';
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
  APP_VERSION:'1.7.4'
};

/* index.html tải config.js trước data.js/app.js. Nạp patch đồng bộ để patch có thể
   biến đổi NV_DATA và bổ sung mode/focus vào payload trước khi app chạy. */
if(document.readyState==='loading'&&!window.__RADENGUVAN_V174_PATCH_LOADING__){
  window.__RADENGUVAN_V174_PATCH_LOADING__=true;
  document.write('<script src="v174-patch.js?v=1.7.4"><\/script>');
}

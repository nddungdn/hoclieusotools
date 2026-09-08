/* V1.7.3: giữ thiết lập V1.7.1 nhưng loại bỏ đề/tiến trình cũ một lần,
   vì V1.7.3 bổ sung descriptorId và kiểm tra cấu trúc câu chặt hơn. */
(()=>{
  const DRAFT='radenguvan_v1_7_1_draft';
  const MARK='radenguvan_v1_7_3_draft_migrated';
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
  APP_VERSION:'1.7.3'
};

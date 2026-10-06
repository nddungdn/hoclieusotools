// Chỉ tự thử lại các yêu cầu đọc lịch; không gửi lại đăng nhập hoặc thao tác POST.
const RETRY_STATUS=new Set([500,502,503,504]);
export async function fetchTimetable(url,options={},{
  fetcher=globalThis.fetch,
  wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
  onRetry=()=>{}
}={}){
  const canRetry=(options.method||'GET').toUpperCase()==='GET'&&['/api/public','/api/teachers'].includes(new URL(url).pathname);
  const attempts=canRetry?3:1;
  for(let attempt=0;attempt<attempts;attempt++){
    let response;
    try{response=await fetcher(url,{...options,signal:AbortSignal.timeout(30000)});}
    catch(error){if(attempt===attempts-1)throw error;}
    if(response&&(!RETRY_STATUS.has(response.status)||attempt===attempts-1))return response;
    if(response)await response.body?.cancel().catch(()=>{});
    onRetry(attempt+1);
    await wait(attempt===0?1000:3000);
  }
}

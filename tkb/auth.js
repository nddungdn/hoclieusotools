export const AUTH_KEY='lhp-tkb-v1:auth';
export const REMEMBER_SECONDS=30*24*3600;
// Chỉ lưu mã phiên và hạn dùng; không lưu tên đăng nhập hoặc mật khẩu.
export function createAuthStore({local=()=>globalThis.localStorage,session=()=>globalThis.sessionStorage,now=()=>Date.now()}={}){
  let current=null,place=null;
  const area=kind=>{try{return(kind==='local'?local:session)();}catch{return null;}};
  const remove=(kind,key)=>{try{area(kind)?.removeItem(key);}catch{}};
  const valid=record=>record&&typeof record.token==='string'&&record.token.length>0&&record.token.length<1600&&Number.isFinite(record.expiresAt)&&record.expiresAt>now();
  function clear(){current=null;place=null;for(const kind of ['local','session'])for(const key of [AUTH_KEY,'lhp-tkb-v1:token','lhp-tkb-v1:teacher'])remove(kind,key);}
  function restore(){
    if(current){if(valid(current))return{...current};clear();return null;}
    for(const kind of ['local','session']){
      try{const raw=area(kind)?.getItem(AUTH_KEY);if(!raw)continue;const record=JSON.parse(raw);if(valid(record)){current={token:record.token,expiresAt:record.expiresAt,teacherId:typeof record.teacherId==='string'?record.teacherId:''};place=kind;return{...current};}}catch{}
      remove(kind,AUTH_KEY);
    }
    return null;
  }
  function write(kind){try{const storage=area(kind);if(!storage)return false;storage.setItem(AUTH_KEY,JSON.stringify(current));return true;}catch{return false;}}
  function save(token,expiresIn,remember){
    if(typeof token!=='string'||!token||token.length>=1600||!Number.isInteger(expiresIn)||expiresIn<=0||expiresIn>REMEMBER_SECONDS)throw Error('Máy chủ trả phiên đăng nhập không hợp lệ.');
    current={token,expiresAt:now()+expiresIn*1000,teacherId:''};place=remember?'local':'session';
    // Thay phiên trong một lần ghi để các tab khác không nhận nhầm sự kiện đăng xuất.
    for(const kind of ['local','session']){if(kind!==place)remove(kind,AUTH_KEY);for(const key of ['lhp-tkb-v1:token','lhp-tkb-v1:teacher'])remove(kind,key);}
    const saved=write(place);if(!saved){remove(place,AUTH_KEY);if(remember){place='session';write(place);}}return saved;
  }
  function selectTeacher(id){if(!restore())return;current.teacherId=String(id||'');if(place)write(place);}
  function refresh(){current=null;place=null;return restore();}
  return{restore,save,selectTeacher,clear,refresh};
}

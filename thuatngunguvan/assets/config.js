window.TL_APP_CONFIG = Object.freeze({
  // Đây là địa chỉ Cloudflare Worker công khai, không phải địa chỉ Apps Script.
  apiBaseUrl: 'https://thuat-ngu-ngu-van-api.nddungdn.workers.dev',
  recentKey: 'hoclieuso_thuat_ngu_ngu_van_recent_v2',
  sessionKey: 'hoclieuso_thuat_ngu_ngu_van_session_v1',
  legacyCacheKeys: ['hoclieuso_thuat_ngu_ngu_van_cache_v1'],
  searchLimit: 36,
  detailCacheLimit: 12,
  requestTimeout: 9000,
  searchDelay: 300
});

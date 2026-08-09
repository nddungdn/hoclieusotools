window.TL_APP_CONFIG = Object.freeze({
  // Đây là địa chỉ Cloudflare Worker công khai, không phải địa chỉ Apps Script.
  apiBaseUrl: 'https://thuat-ngu-ngu-van-api.nddungdn.workers.dev',
  recentKey: 'hoclieuso_thuat_ngu_ngu_van_recent_v2',
  sessionKey: 'hoclieuso_thuat_ngu_ngu_van_session_v1',
  legacyCacheKeys: ['hoclieuso_thuat_ngu_ngu_van_cache_v1'],
  searchLimit: 36,
  detailCacheLimit: 12,
  requestTimeout: 9000,
  searchDelay: 300,

  // AI dùng API key cá nhân. Key chỉ được app lưu trong sessionStorage.
  aiProvider: 'gemini',
  aiModel: 'gemini-2.5-flash',
  aiKeySessionKey: 'hoclieuso_thuat_ngu_ai_key_v1',
  aiMaxQuestionLength: 500,
  aiMaxConversationTurns: 6,
  aiMaxOutputTokens: 900,
  aiRequestTimeout: 30000
});

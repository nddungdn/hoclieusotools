window.LG_AI_CONFIG = Object.freeze({
  aiDefaultProvider: 'gemini',
  aiKeyStoreSessionKey: 'hoclieuso_150tn_ai_keys_v2',
  aiProviderSessionKey: 'hoclieuso_150tn_ai_provider_v2',
  aiModelStoreSessionKey: 'hoclieuso_150tn_ai_models_v2',
  aiProviders: Object.freeze({
    gemini: Object.freeze({
      label: 'Google Gemini',
      keyLabel: 'Gemini API key',
      guideUrl: 'https://www.hoclieuso.id.vn/2026/06/cach-tao-api-key-google-ai-studio.html',
      defaultModel: 'gemini-2.5-flash',
      models: Object.freeze([
        Object.freeze({ value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' }),
        Object.freeze({ value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' }),
        Object.freeze({ value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' }),
        Object.freeze({ value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }),
        Object.freeze({ value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' })
      ])
    }),
    openai: Object.freeze({
      label: 'OpenAI',
      keyLabel: 'OpenAI API key',
      guideUrl: 'https://platform.openai.com/api-keys',
      defaultModel: 'gpt-5-mini',
      models: Object.freeze([
        Object.freeze({ value: 'gpt-5-mini', label: 'GPT-5 mini' }),
        Object.freeze({ value: 'gpt-4o-mini', label: 'GPT-4o mini' })
      ])
    }),
    openrouter: Object.freeze({
      label: 'OpenRouter',
      keyLabel: 'OpenRouter API key',
      guideUrl: 'https://openrouter.ai/settings/keys',
      defaultModel: 'google/gemini-2.5-flash',
      models: Object.freeze([
        Object.freeze({ value: 'google/gemini-3.6-flash', label: 'Gemini 3.6 Flash' }),
        Object.freeze({ value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' }),
        Object.freeze({ value: 'openai/gpt-5-mini', label: 'GPT-5 mini' }),
        Object.freeze({ value: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' })
      ])
    }),
    groq: Object.freeze({
      label: 'Groq',
      keyLabel: 'Groq API key',
      guideUrl: 'https://console.groq.com/keys',
      defaultModel: 'llama-3.3-70b-versatile',
      models: Object.freeze([
        Object.freeze({ value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' }),
        Object.freeze({ value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' }),
        Object.freeze({ value: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B' })
      ])
    })
  }),
  aiMaxQuestionLength: 500,
  aiMaxConversationTurns: 6,
  aiMaxOutputTokens: 4096,
  aiRequestTimeout: 60000
});

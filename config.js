const CONFIG = Object.freeze({
  APP: Object.freeze({
    NAME: "Sidney Platform - 仙遊者 Discord Module",
    VERSION: "4.3.18"
  }),

  GEMINI: Object.freeze({
    MODEL: "gemini-3.5-flash-lite",
    FALLBACK_MODELS: [
      "gemini-3.5-flash"
    ],
    MAX_OUTPUT_TOKENS: 1600,
    REQUEST_TIMEOUT_MS: 45000,
    MAX_RETRIES: 2
  }),

  MEMORY: Object.freeze({
    MAX_TURNS: 8,
    MAX_CHARACTERS: 12000,
    TTL_SECONDS: 60 * 60 * 24 * 30
  })
});

export default CONFIG;

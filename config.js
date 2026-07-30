const CONFIG = Object.freeze({
  APP: Object.freeze({
    NAME: "☯【仙遊者】☯ Discord AI Bot",
    VERSION: "4.2.3"
  }),

  GEMINI: Object.freeze({
    MODEL: "gemini-3.5-flash-lite",
    FALLBACK_MODELS: [
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite"
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

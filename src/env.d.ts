declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL: string,
      PUSHOVER_API_KEY: string,
      VERIFICATION_CODE_LIFETIME_MS: number,
      AES_KEY: string,
    }
  }
}

export {};

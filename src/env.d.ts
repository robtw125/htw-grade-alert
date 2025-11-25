declare global {
  namespace NodeJS {
    interface ProcessEnv {
      HTW_USERNAME: string;
      HTW_PASSWORD: string;
    }
  }
}

export {};

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEPLOY_MODE?: string;
  readonly VITE_DEFAULT_PACK_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

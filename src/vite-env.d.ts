/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PROXY_URL: string
  readonly VITE_CLIENT_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

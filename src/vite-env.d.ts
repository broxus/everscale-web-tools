/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

interface ImportMetaEnv {
  readonly BYTIE_CURRENCY: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

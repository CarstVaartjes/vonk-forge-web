/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RECIPE_LIBRARY_INDEX_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

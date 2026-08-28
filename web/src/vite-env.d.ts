/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CATALOG_API_URL?: string;
  readonly VITE_RECIPE_LIBRARY_INDEX_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

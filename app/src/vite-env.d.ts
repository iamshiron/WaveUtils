/// <reference types="vite/client" />

interface ImportMetaEnv {
	/** Public base path the app is served from (Vite `base`). */
	readonly BASE_URL: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

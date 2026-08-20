/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ORIGIN?: string;
  readonly VITE_REVENUECAT_IOS_API_KEY?: string;
  readonly VITE_ADMIN_EMAILS?: string;
  readonly VITE_TEST_PILOT_UIDS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

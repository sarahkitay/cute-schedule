/** App Store / RevenueCat product identifier */
export const PRO_PRODUCT_ID = "proyou_pro_monthly";
/** User-facing plan name (never show PRO_PRODUCT_ID underscores in UI). */
export const PRO_PRODUCT_DISPLAY_NAME = "ProYou Pro monthly";

/** RevenueCat entitlement identifier (configure in RevenueCat dashboard) */
export const PRO_ENTITLEMENT_ID = "pro";

export const FREE_COACH_PROMPTS_PER_DAY = 2;

/** Morning + evening routine templates on free tier */
export const FREE_ROUTINE_TEMPLATE_LIMIT = 2;

/** Max optional modules pinned/enabled on free tier (core nav excluded) */
export const FREE_OPTIONAL_MODULE_LIMIT = 6;

export const SKIP_LOGIN_STORAGE_KEY = "proyou_skip_login_v1";

export const SUBSCRIPTION_SNAPSHOT_KEY = "proyou_subscription_snapshot_v1";

/** First 30 days after first app open: meds, fitness, insights, alarms included */
export const APP_TRIAL_START_KEY = "proyou_app_trial_start_v1";
export const APP_TRIAL_DAYS = 30;
/** Trial data lives in local storage; subscribing later does not wipe it. */
export const APP_TRIAL_DATA_RETENTION_HINT =
  "Your schedules, habits, meds logs, and other data stay on this device. Subscribe anytime to unlock Pro features again. Nothing is deleted.";

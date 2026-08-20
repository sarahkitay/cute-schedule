import { getDockNavAsset } from "./dockNavAssets";

/** Map legacy / alias ids to the tab id used in app state. */
export const TAB_ID_ALIASES = Object.freeze({
  list: "plan",
});

export function resolveTabId(moduleId) {
  const id = String(moduleId || "").trim();
  return TAB_ID_ALIASES[id] || id;
}

/** Catalog module id for the active app tab (e.g. plan, health). */
export function moduleIdForTab(tab) {
  const t = String(tab || "").trim();
  if (!t || t === "today") return null;
  const mod = APP_MODULE_CATALOG.find((m) => m.tab === t);
  return mod ? mod.id : TAB_ID_ALIASES[t] || t;
}

/** All modules users can open or pin to the dock. */
export const APP_MODULE_CATALOG = Object.freeze([
  { id: "today", tab: "today", alwaysNav: true, canUnpin: false },
  { id: "plan", tab: "plan", aliases: ["list"] },
  { id: "monthly", tab: "monthly" },
  { id: "coach", tab: "coach", centerAction: true },
  { id: "insights", tab: "insights" },
  { id: "you", tab: "you" },
  { id: "medications", tab: "medications" },
  { id: "health", tab: "health" },
  { id: "finance", tab: "finance" },
  { id: "notes", tab: "notes" },
  { id: "timers", tab: "timers" },
  { id: "alarms", tab: "alarms" },
  { id: "period", tab: "period" },
]);

const CATALOG_BY_ID = Object.fromEntries(
  APP_MODULE_CATALOG.flatMap((m) => [[m.id, m], ...(m.aliases || []).map((a) => [a, m])])
);

export const DEFAULT_ENABLED_MODULES = Object.freeze([
  "today",
  "plan",
  "coach",
  "insights",
  "you",
  "monthly",
  "medications",
  "health",
  "finance",
  "notes",
  "timers",
  "alarms",
]);

export const DEFAULT_NAV_ORDER = Object.freeze([
  "today",
  "plan",
  "coach",
  "you",
]);

const CORE_NAV_VISIBILITY_KEYS = Object.freeze(["plan", "health", "coach", "notes", "finance"]);

export function normalizeEnabledModules(raw) {
  if (!Array.isArray(raw)) return [...DEFAULT_ENABLED_MODULES];
  const out = [];
  const seen = new Set();
  for (const id of raw) {
    const mod = CATALOG_BY_ID[id];
    if (!mod || seen.has(mod.id)) continue;
    seen.add(mod.id);
    out.push(mod.id);
  }
  if (!seen.has("today")) out.unshift("today");
  return out.length ? out : [...DEFAULT_ENABLED_MODULES];
}

/** Ensures newer modules appear for users who saved an older enabled list. */
export function mergeMissingEnabledModules(raw) {
  const normalized = normalizeEnabledModules(raw);
  const extras = ["alarms"];
  const set = new Set(normalized.filter((id) => id !== "period"));
  let added = false;
  for (const id of extras) {
    if (!set.has(id)) {
      set.add(id);
      added = true;
    }
  }
  return added ? [...set] : normalized;
}

export function normalizeNavOrder(raw, enabledModules) {
  const enabled = new Set(normalizeEnabledModules(enabledModules));
  const out = [];
  const seen = new Set();
  const source = Array.isArray(raw) && raw.length ? raw : [...DEFAULT_NAV_ORDER];
  for (const id of source) {
    const mod = CATALOG_BY_ID[id];
    if (!mod || seen.has(mod.id)) continue;
    if (!mod.alwaysNav && !enabled.has(mod.id)) continue;
    seen.add(mod.id);
    out.push(mod.id);
  }
  if (!seen.has("today")) out.unshift("today");
  return out;
}

export function isModuleEnabled(moduleId, enabledModules) {
  const mod = CATALOG_BY_ID[moduleId];
  if (!mod) return false;
  const enabled = normalizeEnabledModules(enabledModules);
  return enabled.includes(mod.id);
}

export function isModuleInNav(moduleId, navOrder, enabledModules) {
  const mod = CATALOG_BY_ID[moduleId];
  if (!mod) return false;
  if (mod.alwaysNav) return true;
  const order = normalizeNavOrder(navOrder, enabledModules);
  return order.includes(mod.id) && isModuleEnabled(mod.id, enabledModules);
}

export function getModulesNotInNav(navOrder, enabledModules) {
  const order = new Set(normalizeNavOrder(navOrder, enabledModules));
  return APP_MODULE_CATALOG.filter((m) => !m.alwaysNav && !order.has(m.id) && isModuleEnabled(m.id, enabledModules));
}

/** All catalog modules not pinned in the nav bar (for home tray "add" pool). */
export function getAvailableModulesNotInNav(navOrder, enabledModules) {
  const order = new Set(normalizeNavOrder(navOrder, enabledModules));
  return APP_MODULE_CATALOG.filter((m) => !m.alwaysNav && !order.has(m.id));
}

export function getModulesInNav(navOrder, enabledModules) {
  return normalizeNavOrder(navOrder, enabledModules)
    .map((id) => CATALOG_BY_ID[id])
    .filter(Boolean);
}

/** Enabled modules pinned for home-screen access but not in the bottom nav. */
export function getHomeScreenModules(navOrder, enabledModules) {
  return getModulesNotInNav(navOrder, enabledModules);
}

export function addModuleToNav(moduleId, navOrder, enabledModules) {
  const mod = CATALOG_BY_ID[moduleId];
  if (!mod) return { navOrder, enabledModules };
  const enabled = normalizeEnabledModules(enabledModules);
  const nextEnabled = enabled.includes(mod.id) ? enabled : [...enabled, mod.id];
  let order = normalizeNavOrder(navOrder, nextEnabled);
  if (!order.includes(mod.id)) {
    const youIdx = order.indexOf("you");
    if (youIdx >= 0) order = [...order.slice(0, youIdx), mod.id, ...order.slice(youIdx)];
    else order = [...order, mod.id];
  }
  return { navOrder: order, enabledModules: nextEnabled };
}

export function removeModuleFromNav(moduleId, navOrder, enabledModules) {
  const mod = CATALOG_BY_ID[moduleId];
  if (!mod || mod.alwaysNav) return { navOrder, enabledModules };
  const order = normalizeNavOrder(navOrder, enabledModules).filter((id) => id !== mod.id);
  return { navOrder: order, enabledModules: normalizeEnabledModules(enabledModules) };
}

export function reorderNavModule(fromId, toId, navOrder, enabledModules) {
  const order = [...normalizeNavOrder(navOrder, enabledModules)];
  const fromMod = CATALOG_BY_ID[fromId];
  const toMod = CATALOG_BY_ID[toId];
  if (!fromMod || !toMod) return order;
  const fromIdx = order.indexOf(fromMod.id);
  const toIdx = order.indexOf(toMod.id);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return order;
  order.splice(fromIdx, 1);
  order.splice(toIdx, 0, fromMod.id);
  return order;
}

/** Build bottom dock items from explicit nav order (pinned tabs only). */
export function buildMainDockItems({ navOrder, enabledModules }) {
  const enabled = normalizeEnabledModules(enabledModules);
  const order = normalizeNavOrder(navOrder, enabled);

  const seen = new Set();
  const items = [];
  for (const moduleId of order) {
    const mod = CATALOG_BY_ID[moduleId];
    if (!mod || seen.has(mod.id)) continue;
    if (!mod.alwaysNav && !enabled.includes(mod.id)) continue;
    seen.add(mod.id);
    const asset = getDockNavAsset(mod.id);
    items.push({
      id: mod.tab,
      moduleId: mod.id,
      label: asset.label,
      headerLabel: asset.label,
      centerAction: !!mod.centerAction,
    });
  }

  if (!items.some((i) => i.id === "today")) {
    const asset = getDockNavAsset("today");
    items.unshift({
      id: "today",
      moduleId: "today",
      label: asset.label,
      headerLabel: "Today",
      centerAction: false,
    });
  }

  return items;
}

export function syncNavVisibilityFromModules(enabledModules, navOrder, navVisibility) {
  const order = normalizeNavOrder(navOrder, enabledModules);
  const next = { ...navVisibility };
  for (const key of CORE_NAV_VISIBILITY_KEYS) {
    next[key] = order.includes(key) && isModuleEnabled(key, enabledModules);
  }
  next.today = true;
  return next;
}

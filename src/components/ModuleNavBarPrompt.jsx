import React from "react";
import { DockNavIcon } from "../DockNavIcon";
import { getDockNavAsset } from "../dockNavAssets";
import {
  addModuleToNav,
  isModuleInNav,
} from "../appNavModel";

/**
 * Shown at the top of a module opened from You when that module is not in the bottom nav.
 */
export function ModuleNavBarPrompt({
  moduleId,
  promptModuleId,
  navOrder,
  enabledModules,
  onNavPreferencesChange,
  onDismiss,
}) {
  if (!moduleId || moduleId !== promptModuleId) return null;
  if (isModuleInNav(moduleId, navOrder, enabledModules)) return null;

  const label = getDockNavAsset(moduleId).label;

  function enableInNav() {
    const { navOrder: nextOrder, enabledModules: nextEnabled } = addModuleToNav(
      moduleId,
      navOrder,
      enabledModules
    );
    onNavPreferencesChange?.(nextOrder, nextEnabled);
    onDismiss?.();
  }

  return (
    <div className="module-nav-prompt surface-glass" role="region" aria-label="Navigation shortcut">
      <div className="module-nav-prompt__main">
        <DockNavIcon tabId={moduleId} active={false} />
        <div className="module-nav-prompt__text">
          <p className="module-nav-prompt__title">Show {label} in nav bar?</p>
          <p className="settings-hint module-nav-prompt__hint">
            Turn on to pin {label} to your bottom navigation for quick access.
          </p>
        </div>
      </div>
      <label className="module-nav-prompt__toggle">
        <span className="module-nav-prompt__toggle-label">Show in nav bar</span>
        <input type="checkbox" checked={false} onChange={enableInNav} aria-label={`Show ${label} in nav bar`} />
        <span className="module-nav-prompt__switch" aria-hidden />
      </label>
    </div>
  );
}

import React, { useMemo, useState } from "react";
import { DockNavIcon } from "./DockNavIcon";
import { getDockNavAsset } from "./dockNavAssets";
import {
  APP_MODULE_CATALOG,
  addModuleToNav,
  removeModuleFromNav,
  reorderNavModule,
} from "./appNavModel";

/**
 * Home screen: shows what's in the bottom nav; drag to reorder, remove, or add modules.
 */
export function HomeModuleTray({
  navOrder,
  enabledModules,
  dockItems = [],
  onNavPreferencesChange,
  onOpenModule,
}) {
  const [dragId, setDragId] = useState(null);
  const [dropHint, setDropHint] = useState(null);

  const catalogById = useMemo(
    () => Object.fromEntries(APP_MODULE_CATALOG.map((m) => [m.id, m])),
    []
  );

  const inNav = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const item of dockItems) {
      const mod = catalogById[item.moduleId || item.id];
      if (!mod || seen.has(mod.id)) continue;
      seen.add(mod.id);
      out.push(mod);
    }
    return out;
  }, [dockItems, catalogById]);

  const inNavIds = useMemo(() => new Set(inNav.map((m) => m.id)), [inNav]);

  const notInNav = useMemo(
    () => APP_MODULE_CATALOG.filter((m) => !m.alwaysNav && !inNavIds.has(m.id)),
    [inNavIds]
  );

  function applyNav(nextOrder, nextEnabled) {
    onNavPreferencesChange?.(nextOrder, nextEnabled);
  }

  function handleDragStart(moduleId) {
    setDragId(moduleId);
  }

  function handleDragEnd() {
    setDragId(null);
    setDropHint(null);
  }

  function handleDropOnNav(targetModuleId, droppedModuleId) {
    const dragMod = droppedModuleId || dragId;
    if (!dragMod) return;
    setDragId(null);
    setDropHint(null);

    if (inNavIds.has(dragMod)) {
      if (targetModuleId && dragMod !== targetModuleId) {
        applyNav(reorderNavModule(dragMod, targetModuleId, navOrder, enabledModules), enabledModules);
      }
      return;
    }

    const { navOrder: nextOrder, enabledModules: nextEnabled } = addModuleToNav(
      dragMod,
      navOrder,
      enabledModules
    );
    let order = nextOrder;
    if (targetModuleId && dragMod !== targetModuleId) {
      order = reorderNavModule(dragMod, targetModuleId, order, nextEnabled);
    }
    applyNav(order, nextEnabled);
  }

  function handleDropOnLibrary() {
    if (!dragId || !inNavIds.has(dragId)) return;
    const mod = catalogById[dragId];
    if (!mod || mod.alwaysNav) return;
    const { navOrder: nextOrder } = removeModuleFromNav(dragId, navOrder, enabledModules);
    applyNav(nextOrder, enabledModules);
    setDragId(null);
    setDropHint(null);
  }

  function removeFromNav(moduleId) {
    const { navOrder: nextOrder } = removeModuleFromNav(moduleId, navOrder, enabledModules);
    applyNav(nextOrder, enabledModules);
  }

  function addToNav(moduleId) {
    const { navOrder: nextOrder, enabledModules: nextEnabled } = addModuleToNav(
      moduleId,
      navOrder,
      enabledModules
    );
    applyNav(nextOrder, nextEnabled);
  }

  return (
    <section className="home-module-tray scroll-reveal" aria-label="Customize navigation">
      <div className="home-module-tray-head">
        <h3 className="home-module-tray-title">Navigation</h3>
        <p className="home-module-tray-hint">
          Matches your bottom nav bar. Drag to reorder, tap × to remove, or drag modules up from below to add.
        </p>
      </div>

      <p className="home-module-tray-section-label">In your nav bar</p>
      <div
        className={`home-module-tray-nav${dropHint === "nav" ? " is-drop-target" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDropHint("nav");
        }}
        onDragLeave={() => setDropHint(null)}
        onDrop={(e) => {
          e.preventDefault();
          handleDropOnNav(null, e.dataTransfer.getData("text/module-id") || dragId);
        }}
      >
        {inNav.length === 0 ? (
          <p className="home-module-tray-empty">No modules in nav yet — add some below.</p>
        ) : (
          inNav.map((mod) => {
            const asset = getDockNavAsset(mod.id);
            return (
              <div
                key={mod.id}
                className={`home-module-tray-nav-slot${dragId === mod.id ? " is-dragging" : ""}${dropHint === mod.id ? " is-drop-hint" : ""}${mod.centerAction ? " is-center-slot" : ""}`}
                draggable={!mod.alwaysNav}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/module-id", mod.id);
                  handleDragStart(mod.id);
                }}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropHint(mod.id);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOnNav(
                    mod.id,
                    e.dataTransfer.getData("text/module-id") || dragId
                  );
                }}
              >
                <DockNavIcon tabId={mod.id} active={false} variant={mod.centerAction ? "center" : "default"} />
                <span className="home-module-tray-label">{asset.label}</span>
                {!mod.alwaysNav ? (
                  <button
                    type="button"
                    className="home-module-tray-unpin"
                    aria-label={`Remove ${asset.label} from nav`}
                    onClick={() => removeFromNav(mod.id)}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {notInNav.length > 0 ? (
        <>
          <p className="home-module-tray-section-label">Not in nav — drag or tap Add</p>
          <div
            className={`home-module-tray-grid${dropHint === "library" ? " is-drop-target" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDropHint("library");
            }}
            onDragLeave={() => setDropHint(null)}
            onDrop={(e) => {
              e.preventDefault();
              handleDropOnLibrary();
            }}
          >
            {notInNav.map((mod) => {
              const asset = getDockNavAsset(mod.id);
              return (
                <div
                  key={mod.id}
                  className={`home-module-tray-tile${dragId === mod.id ? " is-dragging" : ""}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/module-id", mod.id);
                    handleDragStart(mod.id);
                  }}
                  onDragEnd={handleDragEnd}
                >
                  <button
                    type="button"
                    className="home-module-tray-tile-main"
                    onClick={() => onOpenModule(mod.tab)}
                  >
                    <DockNavIcon tabId={mod.id} active={false} />
                    <span className="home-module-tray-label">{asset.label}</span>
                  </button>
                  <button
                    type="button"
                    className="home-module-tray-add"
                    onClick={() => addToNav(mod.id)}
                  >
                    Add
                  </button>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="home-module-tray-all-in">All modules are in your nav bar.</p>
      )}
    </section>
  );
}

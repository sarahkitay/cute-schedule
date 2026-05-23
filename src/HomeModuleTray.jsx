import React, { useState } from "react";
import { DockNavIcon } from "./DockNavIcon";
import { getDockNavAsset } from "./dockNavAssets";
import {
  getModulesInNav,
  getModulesNotInNav,
  addModuleToNav,
  removeModuleFromNav,
  reorderNavModule,
} from "./appNavModel";

/**
 * Home screen: draggable module icons — drag extras into the nav strip or reorder pins.
 */
export function HomeModuleTray({
  navOrder,
  enabledModules,
  onNavOrderChange,
  onEnabledModulesChange,
  onOpenModule,
}) {
  const [dragId, setDragId] = useState(null);
  const [dropHint, setDropHint] = useState(null);

  const inNav = getModulesInNav(navOrder, enabledModules);
  const notInNav = getModulesNotInNav(navOrder, enabledModules);

  function handleDragStart(moduleId) {
    setDragId(moduleId);
  }

  function handleDragEnd() {
    setDragId(null);
    setDropHint(null);
  }

  function handleDropOnNav(targetModuleId) {
    if (!dragId) return;
    const dragMod = dragId;
    setDragId(null);
    setDropHint(null);

    const inNavIds = inNav.map((m) => m.id);
    if (inNavIds.includes(dragMod)) {
      if (targetModuleId && dragMod !== targetModuleId) {
        onNavOrderChange(reorderNavModule(dragMod, targetModuleId, navOrder, enabledModules));
      }
      return;
    }

    const { navOrder: nextOrder, enabledModules: nextEnabled } = addModuleToNav(
      dragMod,
      navOrder,
      enabledModules
    );
    onEnabledModulesChange(nextEnabled);
    let order = nextOrder;
    if (targetModuleId && dragMod !== targetModuleId) {
      order = reorderNavModule(dragMod, targetModuleId, order, nextEnabled);
    }
    onNavOrderChange(order);
  }

  function handleDropOnLibrary() {
    if (!dragId) return;
    const mod = inNav.find((m) => m.id === dragId);
    if (!mod || mod.alwaysNav) return;
    const { navOrder: nextOrder } = removeModuleFromNav(dragId, navOrder, enabledModules);
    onNavOrderChange(nextOrder);
    setDragId(null);
    setDropHint(null);
  }

  return (
    <section className="home-module-tray scroll-reveal" aria-label="Customize navigation">
      <div className="home-module-tray-head">
        <h3 className="home-module-tray-title">Navigation</h3>
        <p className="home-module-tray-hint">Drag icons into the bar below to show them in your main nav.</p>
      </div>

      <div
        className={`home-module-tray-nav${dropHint === "nav" ? " is-drop-target" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDropHint("nav");
        }}
        onDragLeave={() => setDropHint(null)}
        onDrop={(e) => {
          e.preventDefault();
          handleDropOnNav(e.dataTransfer.getData("text/module-id") || dragId);
        }}
      >
        {inNav.map((mod) => {
          const asset = getDockNavAsset(mod.id);
          return (
            <div
              key={mod.id}
              className={`home-module-tray-nav-slot${dragId === mod.id ? " is-dragging" : ""}${dropHint === mod.id ? " is-drop-hint" : ""}`}
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
                handleDropOnNav(e.dataTransfer.getData("text/module-id") || dragId || mod.id);
              }}
            >
              <DockNavIcon tabId={mod.id} active={false} />
              <span className="home-module-tray-label">{asset.label}</span>
              {!mod.alwaysNav ? (
                <button
                  type="button"
                  className="home-module-tray-unpin"
                  aria-label={`Remove ${asset.label} from nav`}
                  onClick={() => {
                    const { navOrder: nextOrder } = removeModuleFromNav(mod.id, navOrder, enabledModules);
                    onNavOrderChange(nextOrder);
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {notInNav.length > 0 ? (
        <>
          <p className="home-module-tray-subtitle">More modules</p>
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
                  role="button"
                  tabIndex={0}
                  className={`home-module-tray-tile${dragId === mod.id ? " is-dragging" : ""}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/module-id", mod.id);
                    handleDragStart(mod.id);
                  }}
                  onDragEnd={handleDragEnd}
                  onClick={() => onOpenModule(mod.tab)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenModule(mod.tab);
                    }
                  }}
                >
                  <DockNavIcon tabId={mod.id} active={false} />
                  <span className="home-module-tray-label">{asset.label}</span>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}

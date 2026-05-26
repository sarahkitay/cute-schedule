import React, { useState } from "react";
import { HabitDirectionDot } from "../HabitIconPicker";
import { DockNavIcon } from "../DockNavIcon";
import { getDockNavAsset } from "../dockNavAssets";
import { useIconStyle } from "../IconStyleContext";
import { appIconUrl } from "../iconStyle";
import {
  APP_MODULE_CATALOG,
  addModuleToNav,
  removeModuleFromNav,
  isModuleInNav,
  resolveTabId,
} from "../appNavModel";

export function YouPage({
  profile, setProfile,
  habitTracker, setHabitTracker,
  morningRoutineTemplate, setMorningRoutineTemplate,
  routineTemplate, setRoutineTemplate,
  routineSchedule, setRoutineSchedule,
  onOpenSettings,
  enabledModules,
  navOrder,
  onNavPreferencesChange,
  coachingTone, setCoachingTone,
  onNavigateModule,
}) {
  const [section, setSection] = useState(null);
  const [newHabitLabel, setNewHabitLabel] = useState("");
  const [newHabitDir, setNewHabitDir] = useState("build");
  const [newRoutineLine, setNewRoutineLine] = useState("");
  const [nightRoutineLine, setNightRoutineLine] = useState("");
  const { iconStyle } = useIconStyle();

  const allModules = APP_MODULE_CATALOG.filter((m) => m.id !== "today").map((mod) => {
    const asset = getDockNavAsset(mod.id);
    return {
      id: mod.id,
      tab: mod.tab,
      label: asset.label,
      img: getDockNavAsset(mod.id).image,
    };
  });

  function toggleNavModule(id) {
    const inNav = isModuleInNav(id, navOrder, enabledModules);
    if (inNav) {
      const { navOrder: nextOrder } = removeModuleFromNav(id, navOrder, enabledModules);
      onNavPreferencesChange(nextOrder, enabledModules);
      return;
    }
    const { navOrder: nextOrder, enabledModules: nextEnabled } = addModuleToNav(id, navOrder, enabledModules);
    onNavPreferencesChange(nextOrder, nextEnabled);
  }

  function addHabit() {
    if (!newHabitLabel.trim()) return;
    setHabitTracker(prev => ({
      ...prev,
      habits: [...(prev.habits || []), { id: Math.random().toString(36).slice(2) + Date.now().toString(36), label: newHabitLabel.trim(), direction: newHabitDir }],
    }));
    setNewHabitLabel("");
  }

  function removeHabit(id) {
    setHabitTracker(prev => ({ ...prev, habits: (prev.habits || []).filter(h => h.id !== id) }));
  }

  function addMorningItem() {
    if (!newRoutineLine.trim()) return;
    setMorningRoutineTemplate(prev => [...prev, { id: Math.random().toString(36).slice(2), text: newRoutineLine.trim() }]);
    setRoutineSchedule((s) => ({ ...s, enabledMorning: true }));
    setNewRoutineLine("");
  }

  function removeMorningItem(id) {
    setMorningRoutineTemplate(prev => prev.filter(r => r.id !== id));
  }

  function addNightItem() {
    if (!nightRoutineLine.trim()) return;
    setRoutineTemplate(prev => [...prev, { id: Math.random().toString(36).slice(2), text: nightRoutineLine.trim() }]);
    setNightRoutineLine("");
  }

  function removeNightItem(id) {
    setRoutineTemplate(prev => prev.filter(r => r.id !== id));
  }

  if (section === "habits") {
    return (
      <div className="py-flex-col py-gap-4" style={{ padding: "0 4px" }}>
        <button type="button" onClick={() => setSection(null)} style={{ alignSelf: "flex-start", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--py-accent-deep)", fontWeight: 600, padding: "4px 0" }}>← Back</button>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--py-ink)" }}>Habits</h2>
        <div className="py-glass-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input value={newHabitLabel} onChange={e => setNewHabitLabel(e.target.value)} placeholder="New habit..." className="py-input" style={{ flex: 1 }} onKeyDown={e => e.key === "Enter" && addHabit()} />
            <select value={newHabitDir} onChange={e => setNewHabitDir(e.target.value)} style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", background: "rgba(255,255,255,0.7)", fontSize: 13 }}>
              <option value="build">Build</option>
              <option value="break">Break</option>
            </select>
            <button type="button" onClick={addHabit} style={{ padding: "8px 16px", borderRadius: 999, background: "linear-gradient(135deg, #F0B4C4, #D4708A)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add</button>
          </div>
          {(habitTracker.habits || []).length === 0 && <p style={{ fontSize: 14, color: "var(--py-ink-muted)", textAlign: "center", padding: 16 }}>No habits yet. Add one above.</p>}
          {(habitTracker.habits || []).map(h => (
            <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
              <span style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>{h.label}</span>
              <HabitDirectionDot direction={h.direction} />
              <button type="button" onClick={() => removeHabit(h.id)} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.06)", background: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section === "routine") {
    return (
      <div className="py-flex-col py-gap-4" style={{ padding: "0 4px" }}>
        <button type="button" onClick={() => setSection(null)} style={{ alignSelf: "flex-start", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--py-accent-deep)", fontWeight: 600, padding: "4px 0" }}>← Back</button>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--py-ink)" }}>Routines</h2>

        {/* Morning */}
        <div className="py-glass-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--py-ink)" }}>Morning Routine</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--py-ink-secondary)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={routineSchedule?.enabledMorning === true}
                onChange={(e) => setRoutineSchedule((s) => ({ ...s, enabledMorning: e.target.checked }))}
              />
              Show on Today
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input value={newRoutineLine} onChange={e => setNewRoutineLine(e.target.value)} placeholder="Add morning step..." className="py-input" style={{ flex: 1 }} onKeyDown={e => e.key === "Enter" && addMorningItem()} />
            <button type="button" onClick={addMorningItem} style={{ padding: "8px 16px", borderRadius: 999, background: "linear-gradient(135deg, #F0B4C4, #D4708A)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add</button>
          </div>
          {morningRoutineTemplate.map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < morningRoutineTemplate.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
              <span style={{ fontSize: 13, color: "var(--py-ink-muted)", width: 20 }}>{i + 1}.</span>
              <input
                className="py-input"
                value={r.text}
                onChange={(e) => setMorningRoutineTemplate((prev) => prev.map((x, idx) => idx === i ? { ...x, text: e.target.value } : x))}
                aria-label={`Morning step ${i + 1}`}
                style={{ flex: 1, fontSize: 15 }}
              />
              <button type="button" onClick={() => removeMorningItem(r.id)} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.06)", background: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>x</button>
            </div>
          ))}
        </div>

        {/* Night */}
        <div className="py-glass-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--py-ink)" }}>Night Routine</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--py-ink-secondary)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={routineSchedule?.enabledNight !== false}
                onChange={(e) => setRoutineSchedule((s) => ({ ...s, enabledNight: e.target.checked }))}
              />
              Show on Today
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input value={nightRoutineLine} onChange={e => setNightRoutineLine(e.target.value)} placeholder="Add night step..." className="py-input" style={{ flex: 1 }} onKeyDown={e => { if (e.key === "Enter") { addNightItem(); }}} />
            <button type="button" onClick={addNightItem} style={{ padding: "8px 16px", borderRadius: 999, background: "linear-gradient(135deg, #9B8EC4, #7B6BA8)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add</button>
          </div>
          {routineTemplate.map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < routineTemplate.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
              <span style={{ fontSize: 13, color: "var(--py-ink-muted)", width: 20 }}>{i + 1}.</span>
              <input
                className="py-input"
                value={r.text}
                onChange={(e) => setRoutineTemplate((prev) => prev.map((x, idx) => idx === i ? { ...x, text: e.target.value } : x))}
                aria-label={`Night step ${i + 1}`}
                style={{ flex: 1, fontSize: 15 }}
              />
              <button type="button" onClick={() => removeNightItem(r.id)} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.06)", background: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>x</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section === "nav") {
    return (
      <div className="py-flex-col py-gap-4" style={{ padding: "0 4px" }}>
        <button type="button" onClick={() => setSection(null)} style={{ alignSelf: "flex-start", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--py-accent-deep)", fontWeight: 600, padding: "4px 0" }}>← Back</button>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--py-ink)" }}>Customize Navigation</h2>
        <p style={{ fontSize: 13, color: "var(--py-ink-tertiary)", marginBottom: 4 }}>Choose which modules appear in your bottom nav. The bar resizes to fit.</p>
        <p style={{ fontSize: 12, color: "var(--py-ink-muted)" }}>Anything not in the nav is accessible from the bottom of the Home page.</p>
        <div className="py-flex-col py-gap-2">
          {allModules.map(mod => {
            const inNav = isModuleInNav(mod.id, navOrder, enabledModules);
            return (
              <div key={mod.id} onClick={() => toggleNavModule(mod.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: inNav ? "rgba(255,218,230,0.5)" : "rgba(255,255,255,0.5)", border: `1px solid ${inNav ? "rgba(232,169,183,0.3)" : "rgba(0,0,0,0.04)"}`, borderRadius: 18, cursor: "pointer", transition: "all 200ms ease" }}>
                <DockNavIcon tabId={mod.id} active={inNav} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "var(--py-ink)" }}>{mod.label}</div>
                </div>
                <div style={{ width: 44, height: 26, borderRadius: 13, background: inNav ? "var(--py-accent)" : "rgba(180,170,175,0.3)", position: "relative", transition: "background 200ms ease" }}>
                  <div style={{ position: "absolute", top: 3, left: inNav ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.15)", transition: "left 200ms ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="py-flex-col py-gap-5" style={{ padding: "0 4px" }}>
      {/* Profile header */}
      <div className="py-glass-card" style={{ padding: 20, textAlign: "center" }}>
        <img src={appIconUrl("brandLogo", iconStyle)} alt="ProYou" style={{ width: 56, height: 56, borderRadius: 18, objectFit: "cover", margin: "0 auto 10px", display: "block" }} />
        <div style={{ fontSize: 20, fontWeight: 600, color: "var(--py-ink)" }}>{profile.name || "Your Name"}</div>
        {profile.birthday && <div style={{ fontSize: 13, color: "var(--py-ink-tertiary)", marginTop: 2 }}>{profile.birthday}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
          <input value={profile.name || ""} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} placeholder="Your name" className="py-input" style={{ maxWidth: 180, textAlign: "center", fontSize: 14 }} />
        </div>
      </div>

      {/* Quick actions grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <button type="button" onClick={() => setSection("habits")} className="py-glass-card" style={{ padding: 16, border: "none", cursor: "pointer", textAlign: "left" }}>
          <img src={`${import.meta.env.BASE_URL}habit.png`} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: "contain", marginBottom: 8 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--py-ink)" }}>Habits</div>
          <div style={{ fontSize: 12, color: "var(--py-ink-tertiary)" }}>{(habitTracker.habits || []).length} active</div>
        </button>
        <button type="button" onClick={() => setSection("routine")} className="py-glass-card" style={{ padding: 16, border: "none", cursor: "pointer", textAlign: "left" }}>
          <img src={`${import.meta.env.BASE_URL}sunIcon.png`} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: "contain", marginBottom: 8 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--py-ink)" }}>Routines</div>
          <div style={{ fontSize: 12, color: "var(--py-ink-tertiary)" }}>{morningRoutineTemplate.length} morning steps</div>
        </button>
        <button type="button" onClick={() => setSection("nav")} className="py-glass-card" style={{ padding: 16, border: "none", cursor: "pointer", textAlign: "left" }}>
          <img src={`${import.meta.env.BASE_URL}nav.png`} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: "contain", marginBottom: 8 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--py-ink)" }}>Navigation</div>
          <div style={{ fontSize: 12, color: "var(--py-ink-tertiary)" }}>Customize your nav bar</div>
        </button>
        <button type="button" onClick={onOpenSettings} className="py-glass-card" style={{ padding: 16, border: "none", cursor: "pointer", textAlign: "left" }}>
          <img src={appIconUrl("settings", iconStyle)} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: "contain", marginBottom: 8 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--py-ink)" }}>Settings</div>
          <div style={{ fontSize: 12, color: "var(--py-ink-tertiary)" }}>Theme, data, account</div>
        </button>
      </div>

      {/* All modules */}
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--py-ink)", marginBottom: 12 }}>All Modules</h3>
        <div className="py-flex-col py-gap-3">
          {allModules.map(mod => (
            <button key={mod.id} type="button" onClick={() => onNavigateModule(resolveTabId(mod.id))} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "rgba(255,255,255,0.55)", backdropFilter: "blur(16px)", border: "1px solid rgba(0,0,0,0.04)", borderRadius: 18, cursor: "pointer", textAlign: "left", boxShadow: "0 2px 10px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.5)" }}>
              <DockNavIcon tabId={mod.id} active={false} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: "var(--py-ink)" }}>{mod.label}</div>
              </div>
              <span style={{ fontSize: 16, color: "var(--py-ink-muted)" }}>›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

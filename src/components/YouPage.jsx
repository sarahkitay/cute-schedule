import React, { useState } from "react";

export function YouPage({
  profile, setProfile,
  habitTracker, setHabitTracker,
  morningRoutineTemplate, setMorningRoutineTemplate,
  routineTemplate, setRoutineTemplate,
  onOpenSettings,
  enabledModules, setEnabledModules,
  navOrder, setNavOrder,
  coachingTone, setCoachingTone,
  onNavigateModule,
}) {
  const [section, setSection] = useState(null);
  const [newHabitLabel, setNewHabitLabel] = useState("");
  const [newHabitDir, setNewHabitDir] = useState("build");
  const [newRoutineLine, setNewRoutineLine] = useState("");

  const allModules = [
    { id: "health", label: "Fitness", desc: "Workouts, macros & programs", img: "fitness.png" },
    { id: "medications", label: "Medications", desc: "Tracking & reminders", img: "meds.png" },
    { id: "finance", label: "Finance", desc: "Income, spending & patterns", img: "finance.png" },
    { id: "notes", label: "Notes", desc: "Thoughts, journal, ideas", img: null },
    { id: "timers", label: "Timers", desc: "Focus & routine timers", img: null },
    { id: "monthly", label: "Monthly Goals", desc: "Objectives & tracking", img: null },
    { id: "list", label: "Task List", desc: "All tasks in flat view", img: null },
  ];

  const navSlots = ["today", "list", "coach", "insights", "you"];

  function toggleNavModule(id) {
    setNavOrder(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      return [...prev.slice(0, -1), id, prev[prev.length - 1]];
    });
    setEnabledModules(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      return [...prev, id];
    });
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
    setNewRoutineLine("");
  }

  function removeMorningItem(id) {
    setMorningRoutineTemplate(prev => prev.filter(r => r.id !== id));
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
              <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 999, background: h.direction === "break" ? "rgba(212,107,107,0.1)" : "rgba(232,169,183,0.15)", color: h.direction === "break" ? "#B85555" : "#D4708A", textTransform: "uppercase" }}>{h.direction}</span>
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
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--py-ink)" }}>Morning Routine</h2>
        <div className="py-glass-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input value={newRoutineLine} onChange={e => setNewRoutineLine(e.target.value)} placeholder="Add step..." className="py-input" style={{ flex: 1 }} onKeyDown={e => e.key === "Enter" && addMorningItem()} />
            <button type="button" onClick={addMorningItem} style={{ padding: "8px 16px", borderRadius: 999, background: "linear-gradient(135deg, #F0B4C4, #D4708A)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add</button>
          </div>
          {morningRoutineTemplate.map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < morningRoutineTemplate.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
              <span style={{ fontSize: 13, color: "var(--py-ink-muted)", width: 20 }}>{i + 1}.</span>
              <span style={{ flex: 1, fontSize: 15 }}>{r.text}</span>
              <button type="button" onClick={() => removeMorningItem(r.id)} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.06)", background: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
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
        <p style={{ fontSize: 13, color: "var(--py-ink-tertiary)" }}>Add modules to your bottom nav bar. Anything not in the nav is accessible from this page.</p>
        <div className="py-flex-col py-gap-2">
          {allModules.map(mod => {
            const inNav = enabledModules.includes(mod.id);
            return (
              <div key={mod.id} onClick={() => toggleNavModule(mod.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: inNav ? "rgba(255,218,230,0.5)" : "rgba(255,255,255,0.5)", border: `1px solid ${inNav ? "rgba(232,169,183,0.3)" : "rgba(0,0,0,0.04)"}`, borderRadius: 18, cursor: "pointer", transition: "all 200ms ease" }}>
                {mod.img && <img src={`${import.meta.env.BASE_URL}${mod.img}`} alt="" style={{ width: 36, height: 36, borderRadius: 10, objectFit: "contain" }} />}
                {!mod.img && <span style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(232,169,183,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📋</span>}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "var(--py-ink)" }}>{mod.label}</div>
                  <div style={{ fontSize: 12, color: "var(--py-ink-tertiary)" }}>{mod.desc}</div>
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
        <img src={`${import.meta.env.BASE_URL}pyiconnobubble.png`} alt="ProYou" style={{ width: 56, height: 56, borderRadius: 18, objectFit: "cover", margin: "0 auto 10px", display: "block" }} />
        <div style={{ fontSize: 20, fontWeight: 600, color: "var(--py-ink)" }}>{profile.name || "Your Name"}</div>
        {profile.birthday && <div style={{ fontSize: 13, color: "var(--py-ink-tertiary)", marginTop: 2 }}>🎂 {profile.birthday}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
          <input value={profile.name || ""} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} placeholder="Your name" className="py-input" style={{ maxWidth: 180, textAlign: "center", fontSize: 14 }} />
        </div>
      </div>

      {/* Quick actions grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <button type="button" onClick={() => setSection("habits")} className="py-glass-card" style={{ padding: 16, border: "none", cursor: "pointer", textAlign: "left" }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>🔄</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--py-ink)" }}>Habits</div>
          <div style={{ fontSize: 12, color: "var(--py-ink-tertiary)" }}>{(habitTracker.habits || []).length} active</div>
        </button>
        <button type="button" onClick={() => setSection("routine")} className="py-glass-card" style={{ padding: 16, border: "none", cursor: "pointer", textAlign: "left" }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>☀️</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--py-ink)" }}>Routines</div>
          <div style={{ fontSize: 12, color: "var(--py-ink-tertiary)" }}>{morningRoutineTemplate.length} morning steps</div>
        </button>
        <button type="button" onClick={() => setSection("nav")} className="py-glass-card" style={{ padding: 16, border: "none", cursor: "pointer", textAlign: "left" }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>🧭</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--py-ink)" }}>Navigation</div>
          <div style={{ fontSize: 12, color: "var(--py-ink-tertiary)" }}>Customize your nav bar</div>
        </button>
        <button type="button" onClick={onOpenSettings} className="py-glass-card" style={{ padding: 16, border: "none", cursor: "pointer", textAlign: "left" }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>⚙️</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--py-ink)" }}>Settings</div>
          <div style={{ fontSize: 12, color: "var(--py-ink-tertiary)" }}>Theme, data, account</div>
        </button>
      </div>

      {/* All modules */}
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--py-ink)", marginBottom: 12 }}>All Modules</h3>
        <div className="py-flex-col py-gap-3">
          {allModules.map(mod => (
            <button key={mod.id} type="button" onClick={() => onNavigateModule(mod.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "rgba(255,255,255,0.55)", backdropFilter: "blur(16px)", border: "1px solid rgba(0,0,0,0.04)", borderRadius: 18, cursor: "pointer", textAlign: "left", boxShadow: "0 2px 10px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.5)" }}>
              {mod.img && <img src={`${import.meta.env.BASE_URL}${mod.img}`} alt="" style={{ width: 40, height: 40, borderRadius: 12, objectFit: "contain" }} />}
              {!mod.img && <span style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(232,169,183,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📋</span>}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: "var(--py-ink)" }}>{mod.label}</div>
                <div style={{ fontSize: 12, color: "var(--py-ink-tertiary)" }}>{mod.desc}</div>
              </div>
              <span style={{ fontSize: 16, color: "var(--py-ink-muted)" }}>›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

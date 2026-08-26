import React, { useEffect, useState } from "react";
import { touchLocalPref } from "../localPrefsMeta.js";
import { FriendsHub } from "./social/FriendsHub.jsx";
import { PeriodPage } from "./PeriodPage.jsx";
import { useSocial } from "../social/SocialContext.jsx";
import { HabitDirectionDot } from "../HabitIconPicker";
import { HabitCustomReminderFields } from "./HabitCustomReminderFields.jsx";
import { isCustomHabitReminderMode, normalizeHabitRow } from "../habitModel.js";
import { DEFAULT_HABIT_ICON, suggestHabitIconFromLabel } from "../habitIcons.js";
import { DockNavIcon } from "../DockNavIcon";
import { dockNavAssetUrl, getDockNavAsset, resolveDockNavImage } from "../dockNavAssets";
import { useIconStyle } from "../IconStyleContext";
import { appIconUrl, ICON_STYLE_OPTIONS, normalizeIconStyle } from "../iconStyle";
import { THEMES } from "../themes";
import { CheckIcon } from "../Icons";
import {
  APP_MODULE_CATALOG,
  addModuleToNav,
  removeModuleFromNav,
  isModuleInNav,
  resolveTabId,
} from "../appNavModel";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function RoutineDayPicker({ value, onChange }) {
  const selected = Array.isArray(value) ? value : value === "every" ? [0, 1, 2, 3, 4, 5, 6] : [];

  function toggleDay(day) {
    const next = Array.isArray(value) ? value : value === "every" ? [0, 1, 2, 3, 4, 5, 6] : [];
    const has = next.includes(day);
    const nextArr = has ? next.filter((x) => x !== day) : [...next, day].sort((a, b) => a - b);
    onChange(nextArr.length === 7 ? "every" : nextArr.length === 0 ? "every" : nextArr);
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
      <button
        type="button"
        onClick={() => onChange("every")}
        style={{
          padding: "6px 12px",
          borderRadius: 999,
          border: "1px solid rgba(0,0,0,0.08)",
          background: value === "every" ? "var(--py-accent)" : "rgba(255,255,255,0.72)",
          color: value === "every" ? "#fff" : "var(--py-ink-secondary)",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Every day
      </button>
      {WEEKDAY_LABELS.map((label, day) => {
        const on = value === "every" || selected.includes(day);
        return (
          <button
            key={label}
            type="button"
            onClick={() => toggleDay(day)}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,0.08)",
              background: on ? "var(--py-accent)" : "rgba(255,255,255,0.72)",
              color: on ? "#fff" : "var(--py-ink-secondary)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

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
  theme,
  setTheme,
  firebaseUser = null,
  openAccountability = false,
  onAccountabilityOpened,
  periodState,
  onUpdatePeriod,
  showPeriodTracker = false,
  periodTrackerEligible = false,
  onEnablePeriodTracker,
  onAddPeriodToSchedule,
  openPeriod = false,
  onPeriodOpened,
  periodEmbedCalendar = false,
  periodLogDayKey = null,
  onPeriodSessionEnd,
  popToRootSignal = 0,
}) {
  const [section, setSection] = useState(null);
  const social = useSocial();
  const [newHabitLabel, setNewHabitLabel] = useState("");
  const [newHabitDir, setNewHabitDir] = useState("build");
  const [newRoutineLine, setNewRoutineLine] = useState("");
  const [nightRoutineLine, setNightRoutineLine] = useState("");
  const { iconStyle } = useIconStyle();

  useEffect(() => {
    if (!popToRootSignal) return;
    setSection(null);
    onPeriodSessionEnd?.();
  }, [popToRootSignal]);

  useEffect(() => {
    if (openAccountability) {
      setSection("accountability");
      onAccountabilityOpened?.();
    }
  }, [openAccountability, onAccountabilityOpened]);

  useEffect(() => {
    if (openPeriod && showPeriodTracker) {
      setSection("period");
      onPeriodOpened?.();
    }
  }, [openPeriod, showPeriodTracker, onPeriodOpened]);

  const habitsIconSrc = dockNavAssetUrl(resolveDockNavImage("habits", { iconStyle }));
  const navigationIconSrc = dockNavAssetUrl(resolveDockNavImage("nav", { iconStyle }));
  const routinesIconSrc = dockNavAssetUrl(resolveDockNavImage("routines", { iconStyle }));
  const accountabilityIconSrc = appIconUrl("accountability", iconStyle);

  const allModules = APP_MODULE_CATALOG.filter(
    (m) => m.id !== "today" && m.id !== "you" && m.id !== "period",
  ).map((mod) => {
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
    const label = newHabitLabel.trim();
    if (!label) return;
    const next = normalizeHabitRow({
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      label,
      direction: newHabitDir === "break" ? "break" : "build",
      icon: suggestHabitIconFromLabel(label) || DEFAULT_HABIT_ICON,
      reminderSchedule: "none",
      reminderHours: [],
    });
    if (!next) return;
    setHabitTracker((prev) => ({
      ...prev,
      habits: [...(prev.habits || []), next],
      log: prev.log || {},
    }));
    setNewHabitLabel("");
  }

  function removeHabit(id) {
    setHabitTracker((prev) => ({
      habits: (prev.habits || []).filter((h) => h.id !== id),
      log: Object.fromEntries(
        Object.entries(prev.log || {}).map(([dk, day]) => [
          dk,
          typeof day === "object" && day != null
            ? Object.fromEntries(Object.entries(day).filter(([k]) => k !== id))
            : day,
        ])
      ),
    }));
  }

  const customHabitReminders = isCustomHabitReminderMode(profile?.notificationPrefs);

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

  if (section === "accountability") {
    return (
      <FriendsHub
        firebaseUser={firebaseUser}
        onBack={() => setSection(null)}
      />
    );
  }

  if (section === "period" && showPeriodTracker) {
    return (
      <PeriodPage
        periodState={periodState}
        onUpdatePeriod={onUpdatePeriod}
        onBack={() => {
          setSection(null);
          onPeriodSessionEnd?.();
        }}
        onAddPeriodToSchedule={onAddPeriodToSchedule}
        embedCalendar
        initialDayKey={periodLogDayKey}
      />
    );
  }

  if (section === "habits") {
    return (
      <div className="py-flex-col py-gap-4" style={{ padding: "0 4px" }}>
        <button type="button" onClick={() => setSection(null)} style={{ alignSelf: "flex-start", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--py-accent-deep)", fontWeight: 600, padding: "4px 0" }}>← Back</button>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--py-ink)" }}>Habits</h2>
        <p style={{ fontSize: 13, color: "var(--py-ink-tertiary)", margin: 0 }}>
          Build or break habits, log check-ins on Today, and set custom reminder times here when notifications cadence is Custom.
        </p>
        <div className="py-glass-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input value={newHabitLabel} onChange={e => setNewHabitLabel(e.target.value)} placeholder="New habit..." className="py-input" style={{ flex: 1 }} onKeyDown={e => e.key === "Enter" && addHabit()} />
            <select value={newHabitDir} onChange={e => setNewHabitDir(e.target.value)} style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", background: "rgba(255,255,255,0.7)", fontSize: 13 }}>
              <option value="build">Build</option>
              <option value="break">Break</option>
            </select>
            <button type="button" className="you-page-add-btn" onClick={addHabit} style={{ padding: "8px 16px", borderRadius: 999, background: "linear-gradient(135deg, #F0B4C4, #D4708A)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add</button>
          </div>
          {(habitTracker.habits || []).length === 0 && <p style={{ fontSize: 14, color: "var(--py-ink-muted)", textAlign: "center", padding: 16 }}>No habits yet. Add one above.</p>}
          {(habitTracker.habits || []).map((h) => {
            const row = normalizeHabitRow(h) || h;
            return (
            <div key={row.id} style={{ padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>{row.label}</span>
                <HabitDirectionDot direction={row.direction} />
                <button type="button" onClick={() => removeHabit(row.id)} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.06)", background: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>
              {customHabitReminders ? (
                <HabitCustomReminderFields row={row} setHabitTracker={setHabitTracker} />
              ) : null}
            </div>
            );
          })}
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
            <button type="button" className="you-page-add-btn" onClick={addMorningItem} style={{ padding: "8px 16px", borderRadius: 999, background: "linear-gradient(135deg, #F0B4C4, #D4708A)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add</button>
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
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--py-ink-secondary)", marginTop: 4 }}>Days</div>
          <RoutineDayPicker
            value={routineSchedule?.morning ?? "every"}
            onChange={(morning) => setRoutineSchedule((s) => ({ ...s, morning }))}
          />
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
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--py-ink-secondary)", marginTop: 4 }}>Days</div>
          <RoutineDayPicker
            value={routineSchedule?.night ?? "every"}
            onChange={(night) => setRoutineSchedule((s) => ({ ...s, night }))}
          />
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
              <div
                key={mod.id}
                role="switch"
                aria-checked={inNav}
                tabIndex={0}
                onClick={() => toggleNavModule(mod.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleNavModule(mod.id);
                  }
                }}
                className={`you-nav-module-row${inNav ? " you-nav-module-row--on" : ""}`}
              >
                <DockNavIcon tabId={mod.id} active={inNav} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "var(--py-ink)" }}>{mod.label}</div>
                </div>
                <div className={`you-nav-module-switch${inNav ? " you-nav-module-switch--on" : ""}`} aria-hidden>
                  <div className="you-nav-module-switch__knob" />
                </div>
              </div>
            );
          })}
        </div>

        <div className="py-glass-card you-nav-appearance" style={{ padding: 16, marginTop: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--py-ink)", marginBottom: 4 }}>Theme color</div>
          <p style={{ fontSize: 12, color: "var(--py-ink-tertiary)", margin: "0 0 12px" }}>
            Same palettes as Settings - updates the whole app.
          </p>
          <div className="theme-picker">
            {Object.entries(THEMES).map(([key, themeData]) => {
              const swatchInk = themeData.name === "Midnight" || themeData.name === "Mocha" ? "#fafafa" : "#333";
              const selected = theme?.name === themeData.name;
              return (
                <button
                  key={key}
                  type="button"
                  className={`theme-option ${selected ? "selected" : ""}`}
                  onClick={() => {
                    touchLocalPref("theme");
                    setTheme?.(themeData);
                  }}
                  style={{
                    background: themeData.gradient,
                    border: selected ? `3px solid ${swatchInk}` : "2px solid transparent",
                  }}
                  title={themeData.name}
                  aria-label={themeData.name}
                  aria-pressed={selected}
                >
                  {selected ? <CheckIcon style={{ color: swatchInk, width: 18, height: 18 }} /> : null}
                </button>
              );
            })}
          </div>

          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--py-ink)", marginTop: 18, marginBottom: 4 }}>Icon style</div>
          <p style={{ fontSize: 12, color: "var(--py-ink-tertiary)", margin: "0 0 12px" }}>
            Colorful artwork on light themes; metallic icons on Midnight &amp; Mocha.
          </p>
          <div className="icon-style-picker" role="group" aria-label="Icon style">
            {ICON_STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`icon-style-option ${normalizeIconStyle(profile.iconStyle) === opt.id ? "selected" : ""}`}
                onClick={() => {
                  touchLocalPref("iconStyle");
                  setProfile((p) => ({ ...p, iconStyle: opt.id }));
                }}
                aria-pressed={normalizeIconStyle(profile.iconStyle) === opt.id}
              >
                <span className="icon-style-option__label">{opt.label}</span>
                <span className="icon-style-option__desc">{opt.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="you-page page-stack py-flex-col py-gap-5" style={{ padding: "0 4px" }}>
      {/* Profile header */}
      <div className="py-glass-card" style={{ padding: 20, textAlign: "center" }}>
        <img src={appIconUrl("brandLogo", iconStyle)} alt="ProYou" style={{ width: 56, height: 56, borderRadius: 18, objectFit: "cover", margin: "0 auto 10px", display: "block" }} />
        <div style={{ fontSize: 20, fontWeight: 600, color: "var(--py-ink)" }}>{profile.userName?.trim() || "Your Name"}</div>
        {profile.userBirthday ? (
          <div style={{ fontSize: 13, color: "var(--py-ink-tertiary)", marginTop: 2 }}>
            {(() => {
              const d = String(profile.userBirthday).replace(/\D/g, "");
              return d.length >= 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}` : d;
            })()}
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
          <input
            value={profile.userName || ""}
            onChange={(e) => {
              touchLocalPref("userName");
              setProfile((p) => ({ ...p, userName: e.target.value }));
            }}
            placeholder="Your name"
            className="py-input"
            style={{ maxWidth: 180, textAlign: "center", fontSize: 14 }}
            aria-label="Your name"
          />
        </div>
      </div>

      {/* Quick actions grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <button type="button" onClick={() => setSection("habits")} className="py-glass-card" style={{ padding: 16, border: "none", cursor: "pointer", textAlign: "left" }}>
          <img src={habitsIconSrc} alt="" className="you-page-action-icon you-page-action-icon--habits" style={{ width: 34, height: 34, borderRadius: 8, objectFit: "contain", marginBottom: 8 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--py-ink)" }}>Habits</div>
          <div style={{ fontSize: 12, color: "var(--py-ink-tertiary)" }}>{(habitTracker.habits || []).length} active</div>
        </button>
        <button type="button" onClick={() => setSection("routine")} className="py-glass-card" style={{ padding: 16, border: "none", cursor: "pointer", textAlign: "left" }}>
          <img src={routinesIconSrc} alt="" className="you-page-action-icon you-page-action-icon--routines" style={{ width: 34, height: 34, borderRadius: 8, objectFit: "contain", marginBottom: 8 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--py-ink)" }}>Routines</div>
          <div style={{ fontSize: 12, color: "var(--py-ink-tertiary)" }}>{morningRoutineTemplate.length} morning steps</div>
        </button>
        <button type="button" onClick={() => setSection("nav")} className="py-glass-card" style={{ padding: 16, border: "none", cursor: "pointer", textAlign: "left" }}>
          <img src={navigationIconSrc} alt="" className="you-page-action-icon" style={{ width: 34, height: 34, borderRadius: 8, objectFit: "contain", marginBottom: 8 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--py-ink)" }}>Navigation</div>
          <div style={{ fontSize: 12, color: "var(--py-ink-tertiary)" }}>Customize your nav bar</div>
        </button>
        <button type="button" onClick={() => setSection("accountability")} className="py-glass-card" style={{ padding: 16, border: "none", cursor: "pointer", textAlign: "left" }}>
          <img src={accountabilityIconSrc} alt="" className="you-page-action-icon you-page-action-icon--accountability" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "contain", marginBottom: 8 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--py-ink)" }}>Accountability</div>
          <div style={{ fontSize: 12, color: "var(--py-ink-tertiary)" }}>
            {social.friendUids?.length ? `${social.friendUids.length} friend(s)` : "Friends & shared tasks"}
          </div>
        </button>
        <button type="button" onClick={onOpenSettings} className="py-glass-card" style={{ padding: 16, border: "none", cursor: "pointer", textAlign: "left" }}>
          <img src={appIconUrl("settings", iconStyle)} alt="" className="you-page-action-icon you-page-action-icon--settings" style={{ width: 34, height: 34, borderRadius: 8, objectFit: "contain", marginBottom: 8 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--py-ink)" }}>Settings</div>
          <div style={{ fontSize: 12, color: "var(--py-ink-tertiary)" }}>Theme, data, account</div>
        </button>
      </div>

      {/* All modules */}
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--py-ink)", marginBottom: 12 }}>All Modules</h3>
        <div className="py-flex-col py-gap-3">
          {allModules.map(mod => (
            <button
              key={mod.id}
              type="button"
              onClick={() => onNavigateModule(resolveTabId(mod.id), mod.id)}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "rgba(255,255,255,0.55)", backdropFilter: "blur(16px)", border: "1px solid rgba(0,0,0,0.04)", borderRadius: 18, cursor: "pointer", textAlign: "left", boxShadow: "0 2px 10px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.5)" }}
            >
              <DockNavIcon tabId={mod.id} active={false} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: "var(--py-ink)" }}>{mod.label}</div>
              </div>
              <span style={{ fontSize: 16, color: "var(--py-ink-muted)" }}>›</span>
            </button>
          ))}
        </div>
      </div>

      {periodTrackerEligible && !showPeriodTracker ? (
        <div className="you-period-opt-in py-glass-card">
          <h3 className="you-period-opt-in__title">Period tracker</h3>
          <p className="you-period-opt-in__body">
            Would you like to track your cycle privately on this device? Predictions and notes stay on your phone and are never shared.
          </p>
          <div className="you-period-opt-in__actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onEnablePeriodTracker?.()}>
              Turn on period tracker
            </button>
          </div>
        </div>
      ) : null}

      {showPeriodTracker ? (
        <button
          type="button"
          className="you-period-footer-link"
          onClick={() => setSection("period")}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--py-ink)" }}>Period tracker</div>
            <div style={{ fontSize: 12, color: "var(--py-ink-tertiary)", marginTop: 2 }}>
              Cycle calendar and private notes
            </div>
          </div>
          <span style={{ fontSize: 16, color: "var(--py-ink-muted)", flexShrink: 0 }} aria-hidden>
            ›
          </span>
        </button>
      ) : null}
    </div>
  );
}

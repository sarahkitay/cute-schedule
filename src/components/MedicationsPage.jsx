import React, { useState } from "react";
import { GlassCard } from "./GlassCard";
import { PillButton } from "./PillButton";
import { NavIcons } from "./NavIcons";
import { DockNavIcon } from "../DockNavIcon";
import { TextInput } from "./SoftInput";
import { MedReminderEditor } from "./MedReminderEditor";
import {
  getMedicationStatus,
  logMedicationAction,
  getMedicationAdherence,
  normalizeMedication,
  formatMedReminderTimes,
  defaultReminderTimesFromSchedule,
} from "../modules/medications";

export function MedicationsPage({ medications, log, dayKey, onUpdate }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDose, setNewDose] = useState("");
  const [newSchedule, setNewSchedule] = useState(["morning"]);
  const [newReminderEnabled, setNewReminderEnabled] = useState(false);
  const [newReminderTimes, setNewReminderTimes] = useState(["08:00"]);

  const adherence = getMedicationAdherence(medications.filter((m) => !m.archived), log);
  const activeMeds = medications.filter((m) => !m.archived);

  function patchMedication(medId, partial) {
    onUpdate({
      medications: medications.map((m) =>
        m.id === medId ? normalizeMedication({ ...m, ...partial }) : m
      ),
      log,
    });
  }

  function handleAdd() {
    if (!newName.trim()) return;
    const schedule = newSchedule.length ? newSchedule : ["morning"];
    const med = normalizeMedication({
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      name: newName.trim(),
      dose: newDose.trim(),
      schedule,
      notes: "",
      refillDate: null,
      createdAt: Date.now(),
      archived: false,
      reminderEnabled: newReminderEnabled,
      reminderTimes: newReminderEnabled
        ? newReminderTimes.length
          ? newReminderTimes
          : defaultReminderTimesFromSchedule(schedule)
        : [],
    });
    onUpdate({
      medications: [...medications, med],
      log,
    });
    setNewName("");
    setNewDose("");
    setNewSchedule(["morning"]);
    setNewReminderEnabled(false);
    setNewReminderTimes(["08:00"]);
    setShowAdd(false);
  }

  function handleAction(medId, action) {
    onUpdate({
      medications,
      log: logMedicationAction(log, medId, dayKey, action),
    });
  }

  function toggleScheduleTime(time) {
    setNewSchedule((prev) => {
      const next = prev.includes(time) ? prev.filter((t) => t !== time) : [...prev, time];
      if (newReminderEnabled && next.length) {
        setNewReminderTimes(defaultReminderTimesFromSchedule(next.length ? next : ["morning"]));
      }
      return next.length ? next : ["morning"];
    });
  }

  return (
    <div className="py-flex-col py-gap-5">
      <div className="py-section-header">
        <div className="py-section-header__title-row">
          <DockNavIcon tabId="medications" active />
          <h2 className="py-section-header__title">Medications</h2>
        </div>
        <PillButton variant="secondary" size="sm" onClick={() => setShowAdd(!showAdd)}>
          <NavIcons name="plus" size={14} /> Add
        </PillButton>
      </div>

      {adherence !== null && (
        <GlassCard featured>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "var(--py-text-caption)", fontWeight: 600, color: "var(--py-accent-deep)", textTransform: "uppercase" }}>
              7-day adherence
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "var(--py-ink)", marginTop: 4 }}>
              {adherence}%
            </div>
          </div>
        </GlassCard>
      )}

      {showAdd && (
        <GlassCard>
          <div className="py-flex-col py-gap-3">
            <TextInput
              placeholder="Medication name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <TextInput
              placeholder="Dose (e.g. 20mg)"
              value={newDose}
              onChange={(e) => setNewDose(e.target.value)}
            />
            <div>
              <div style={{ fontSize: "var(--py-text-caption)", color: "var(--py-ink-secondary)", marginBottom: "var(--py-space-2)" }}>
                Schedule
              </div>
              <div style={{ display: "flex", gap: "var(--py-space-2)", flexWrap: "wrap" }}>
                {["morning", "afternoon", "evening", "bedtime"].map((time) => (
                  <button
                    key={time}
                    type="button"
                    className={`py-pill-btn py-pill-btn--sm ${newSchedule.includes(time) ? "py-pill-btn--primary" : "py-pill-btn--secondary"}`}
                    onClick={() => toggleScheduleTime(time)}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
            <MedReminderEditor
              enabled={newReminderEnabled}
              times={newReminderTimes}
              onChange={({ reminderEnabled, reminderTimes }) => {
                setNewReminderEnabled(reminderEnabled);
                if (reminderTimes) setNewReminderTimes(reminderTimes);
              }}
            />
            <div style={{ display: "flex", gap: "var(--py-space-2)", marginTop: "var(--py-space-2)" }}>
              <PillButton variant="primary" onClick={handleAdd}>Add medication</PillButton>
              <PillButton variant="ghost" onClick={() => setShowAdd(false)}>Cancel</PillButton>
            </div>
          </div>
        </GlassCard>
      )}

      {activeMeds.length === 0 && !showAdd && (
        <GlassCard>
          <div className="py-text-center" style={{ padding: "var(--py-space-6) 0" }}>
            <p style={{ color: "var(--py-ink-secondary)" }}>
              No medications tracked yet.<br />Add one to start tracking.
            </p>
          </div>
        </GlassCard>
      )}

      {activeMeds.map((med) => {
        const row = normalizeMedication(med);
        const status = getMedicationStatus(log, row.id, dayKey);
        const reminderLabel = row.reminderEnabled ? formatMedReminderTimes(row.reminderTimes) : "";
        return (
          <div key={row.id} className="py-med-card">
            <div className="py-med-item">
              <img src={`${import.meta.env.BASE_URL}meds.png`} alt="" style={{ width: 36, height: 36, borderRadius: 10, objectFit: "contain" }} />
              <div className="py-med-item__info">
                <div className="py-med-item__name">{row.name}</div>
                <div className="py-med-item__dose">
                  {row.dose && `${row.dose} · `}
                  {row.schedule.join(", ")}
                  {reminderLabel ? ` · Remind ${reminderLabel}` : ""}
                </div>
              </div>
              <div className="py-med-item__actions">
                {status ? (
                  <span style={{ fontSize: "var(--py-text-caption)", color: status.action === "taken" ? "var(--py-success)" : "var(--py-ink-muted)", fontWeight: 500 }}>
                    {status.action === "taken" ? "✓ Taken" : status.action === "skipped" ? "Skipped" : "Snoozed"}
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      className="py-habit-row__action py-habit-row__action--check"
                      onClick={() => handleAction(row.id, "taken")}
                      aria-label="Mark taken"
                    >
                      <NavIcons name="check" size={14} />
                    </button>
                    <button
                      type="button"
                      className="py-habit-row__action py-habit-row__action--skip"
                      onClick={() => handleAction(row.id, "skipped")}
                      aria-label="Skip"
                    >
                      <NavIcons name="close" size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
            <MedReminderEditor
              compact
              enabled={row.reminderEnabled}
              times={row.reminderTimes}
              onChange={(patch) => patchMedication(row.id, patch)}
            />
          </div>
        );
      })}

      <footer className="py-med-disclaimer-footer" role="note">
        <p className="py-med-disclaimer-footer__lead">This is not medical advice.</p>
        <p>
          Always take medications as instructed by your clinician. ProYou is only here to help you remember and
          track what you logged. It does not tell you what to take, when to change a dose, or whether a medication
          is right for you.
        </p>
      </footer>
    </div>
  );
}

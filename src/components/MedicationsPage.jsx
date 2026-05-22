import React, { useState } from "react";
import { GlassCard } from "./GlassCard";
import { PillButton } from "./PillButton";
import { NavIcons } from "./NavIcons";
import { TextInput } from "./SoftInput";
import { getMedicationStatus, logMedicationAction, getMedicationAdherence } from "../modules/medications";

export function MedicationsPage({ medications, log, dayKey, onUpdate }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDose, setNewDose] = useState("");
  const [newSchedule, setNewSchedule] = useState(["morning"]);

  const adherence = getMedicationAdherence(medications.filter(m => !m.archived), log);
  const activeMeds = medications.filter((m) => !m.archived);

  function handleAdd() {
    if (!newName.trim()) return;
    const med = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      name: newName.trim(),
      dose: newDose.trim(),
      schedule: newSchedule,
      notes: "",
      refillDate: null,
      createdAt: Date.now(),
      archived: false,
    };
    onUpdate({
      medications: [...medications, med],
      log,
    });
    setNewName("");
    setNewDose("");
    setNewSchedule(["morning"]);
    setShowAdd(false);
  }

  function handleAction(medId, action) {
    onUpdate({
      medications,
      log: logMedicationAction(log, medId, dayKey, action),
    });
  }

  function toggleScheduleTime(time) {
    setNewSchedule((prev) =>
      prev.includes(time) ? prev.filter((t) => t !== time) : [...prev, time]
    );
  }

  return (
    <div className="py-flex-col py-gap-5">
      <div className="py-section-header">
        <h2 className="py-section-header__title">Medications</h2>
        <PillButton variant="secondary" size="sm" onClick={() => setShowAdd(!showAdd)}>
          <NavIcons name="plus" size={14} /> Add
        </PillButton>
      </div>

      {/* Safety disclaimer */}
      <GlassCard compact>
        <p style={{ fontSize: "var(--py-text-caption)", color: "var(--py-ink-muted)", margin: 0, textAlign: "center" }}>
          ⚕️ This is not medical advice. Always confirm medication instructions with your clinician.
        </p>
      </GlassCard>

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
            <NavIcons name="pill" size={36} />
            <p style={{ marginTop: "var(--py-space-3)", color: "var(--py-ink-secondary)" }}>
              No medications tracked yet.<br />Add one to start tracking.
            </p>
          </div>
        </GlassCard>
      )}

      {activeMeds.map((med) => {
        const status = getMedicationStatus(log, med.id, dayKey);
        return (
          <div key={med.id} className="py-med-item">
            <div className="py-med-item__icon">💊</div>
            <div className="py-med-item__info">
              <div className="py-med-item__name">{med.name}</div>
              <div className="py-med-item__dose">
                {med.dose && `${med.dose} · `}{med.schedule.join(", ")}
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
                    onClick={() => handleAction(med.id, "taken")}
                    aria-label="Mark taken"
                  >
                    <NavIcons name="check" size={14} />
                  </button>
                  <button
                    type="button"
                    className="py-habit-row__action py-habit-row__action--skip"
                    onClick={() => handleAction(med.id, "skipped")}
                    aria-label="Skip"
                  >
                    <NavIcons name="close" size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

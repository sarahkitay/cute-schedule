import React, { useState } from "react";
import { GlassCard } from "./GlassCard";
import { PillButton } from "./PillButton";
import { NavIcons } from "./NavIcons";
import { DockNavIcon } from "../DockNavIcon";
import { MedIcon } from "./MedIcon";
import { TextInput } from "./SoftInput";
import { MedReminderEditor } from "./MedReminderEditor";
import { RowMoreMenu } from "./RowMoreMenu";
import {
  getMedicationStatus,
  logMedicationAction,
  getMedicationAdherence,
  normalizeMedication,
  formatMedReminderTimes,
  defaultReminderTimesFromSchedule,
} from "../modules/medications";

const SCHEDULE_SLOTS = ["morning", "afternoon", "evening", "bedtime"];

function MedEditorFields({
  name,
  onNameChange,
  dose,
  onDoseChange,
  schedule,
  onToggleSchedule,
  reminderEnabled,
  reminderTimes,
  onReminderChange,
}) {
  return (
    <div className="py-flex-col py-gap-3">
      <TextInput placeholder="Medication name" value={name} onChange={(e) => onNameChange(e.target.value)} />
      <TextInput placeholder="Dose (e.g. 20mg)" value={dose} onChange={(e) => onDoseChange(e.target.value)} />
      <div>
        <div
          style={{
            fontSize: "var(--py-text-caption)",
            color: "var(--py-ink-secondary)",
            marginBottom: "var(--py-space-2)",
          }}
        >
          Schedule
        </div>
        <div style={{ display: "flex", gap: "var(--py-space-2)", flexWrap: "wrap" }}>
          {SCHEDULE_SLOTS.map((time) => (
            <button
              key={time}
              type="button"
              className={`py-pill-btn py-pill-btn--sm ${schedule.includes(time) ? "py-pill-btn--primary" : "py-pill-btn--secondary"}`}
              onClick={() => onToggleSchedule(time)}
            >
              {time}
            </button>
          ))}
        </div>
      </div>
      <MedReminderEditor
        enabled={reminderEnabled}
        times={reminderTimes}
        onChange={onReminderChange}
      />
    </div>
  );
}

export function MedicationsPage({ medications, log, dayKey, onUpdate }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingMedId, setEditingMedId] = useState(null);
  const [newName, setNewName] = useState("");
  const [newDose, setNewDose] = useState("");
  const [newSchedule, setNewSchedule] = useState(["morning"]);
  const [newReminderEnabled, setNewReminderEnabled] = useState(false);
  const [newReminderTimes, setNewReminderTimes] = useState(["08:00"]);
  const [editName, setEditName] = useState("");
  const [editDose, setEditDose] = useState("");
  const [editSchedule, setEditSchedule] = useState(["morning"]);
  const [editReminderEnabled, setEditReminderEnabled] = useState(false);
  const [editReminderTimes, setEditReminderTimes] = useState(["08:00"]);

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

  function cancelEdit() {
    setEditingMedId(null);
    setEditName("");
    setEditDose("");
    setEditSchedule(["morning"]);
    setEditReminderEnabled(false);
    setEditReminderTimes(["08:00"]);
  }

  function startEdit(med) {
    const row = normalizeMedication(med);
    setShowAdd(false);
    setEditingMedId(row.id);
    setEditName(row.name);
    setEditDose(row.dose);
    setEditSchedule([...row.schedule]);
    setEditReminderEnabled(row.reminderEnabled);
    setEditReminderTimes(
      row.reminderTimes.length
        ? [...row.reminderTimes]
        : defaultReminderTimesFromSchedule(row.schedule)
    );
  }

  function handleDelete(medId, medName) {
    const label = medName?.trim() || "this medication";
    if (!window.confirm(`Remove ${label} from your list? You can add it again later.`)) return;
    onUpdate({
      medications: medications.map((m) =>
        m.id === medId ? normalizeMedication({ ...m, archived: true }) : m
      ),
      log,
    });
    if (editingMedId === medId) cancelEdit();
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

  function handleSaveEdit() {
    if (!editingMedId || !editName.trim()) return;
    const schedule = editSchedule.length ? editSchedule : ["morning"];
    patchMedication(editingMedId, {
      name: editName.trim(),
      dose: editDose.trim(),
      schedule,
      reminderEnabled: editReminderEnabled,
      reminderTimes: editReminderEnabled
        ? editReminderTimes.length
          ? editReminderTimes
          : defaultReminderTimesFromSchedule(schedule)
        : [],
    });
    cancelEdit();
  }

  function handleAction(medId, action) {
    onUpdate({
      medications,
      log: logMedicationAction(log, medId, dayKey, action),
    });
  }

  function toggleScheduleTime(time, { isEdit }) {
    const setter = isEdit ? setEditSchedule : setNewSchedule;
    const reminderOn = isEdit ? editReminderEnabled : newReminderEnabled;
    const setReminderTimes = isEdit ? setEditReminderTimes : setNewReminderTimes;
    setter((prev) => {
      const next = prev.includes(time) ? prev.filter((t) => t !== time) : [...prev, time];
      const resolved = next.length ? next : ["morning"];
      if (reminderOn) {
        setReminderTimes(defaultReminderTimesFromSchedule(resolved));
      }
      return resolved;
    });
  }

  return (
    <div className="py-flex-col py-gap-5">
      <div className="py-section-header">
        <div className="py-section-header__title-row">
          <DockNavIcon tabId="medications" active />
          <h2 className="py-section-header__title">Medications</h2>
        </div>
        <PillButton
          variant="secondary"
          size="sm"
          onClick={() => {
            cancelEdit();
            setShowAdd(!showAdd);
          }}
        >
          <NavIcons name="plus" size={14} /> Add
        </PillButton>
      </div>

      {adherence !== null && (
        <GlassCard featured>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: "var(--py-text-caption)",
                fontWeight: 600,
                color: "var(--py-accent-deep)",
                textTransform: "uppercase",
              }}
            >
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
          <MedEditorFields
            name={newName}
            onNameChange={setNewName}
            dose={newDose}
            onDoseChange={setNewDose}
            schedule={newSchedule}
            onToggleSchedule={(time) => toggleScheduleTime(time, { isEdit: false })}
            reminderEnabled={newReminderEnabled}
            reminderTimes={newReminderTimes}
            onReminderChange={({ reminderEnabled, reminderTimes }) => {
              setNewReminderEnabled(reminderEnabled);
              if (reminderTimes) setNewReminderTimes(reminderTimes);
            }}
          />
          <div style={{ display: "flex", gap: "var(--py-space-2)", marginTop: "var(--py-space-2)" }}>
            <PillButton variant="primary" onClick={handleAdd}>
              Add medication
            </PillButton>
            <PillButton variant="ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </PillButton>
          </div>
        </GlassCard>
      )}

      {activeMeds.length === 0 && !showAdd && (
        <GlassCard>
          <div className="py-text-center" style={{ padding: "var(--py-space-6) 0" }}>
            <p style={{ color: "var(--py-ink-secondary)" }}>
              No medications tracked yet.
              <br />
              Add one to start tracking.
            </p>
          </div>
        </GlassCard>
      )}

      {activeMeds.map((med) => {
        const row = normalizeMedication(med);
        const isEditing = editingMedId === row.id;
        const status = getMedicationStatus(log, row.id, dayKey);
        const reminderLabel = row.reminderEnabled ? formatMedReminderTimes(row.reminderTimes) : "";

        if (isEditing) {
          return (
            <GlassCard key={row.id}>
              <div className="py-med-edit-label" style={{ fontWeight: 600, marginBottom: "var(--py-space-3)" }}>
                Edit medication
              </div>
              <MedEditorFields
                name={editName}
                onNameChange={setEditName}
                dose={editDose}
                onDoseChange={setEditDose}
                schedule={editSchedule}
                onToggleSchedule={(time) => toggleScheduleTime(time, { isEdit: true })}
                reminderEnabled={editReminderEnabled}
                reminderTimes={editReminderTimes}
                onReminderChange={({ reminderEnabled, reminderTimes }) => {
                  setEditReminderEnabled(reminderEnabled);
                  if (reminderTimes) setEditReminderTimes(reminderTimes);
                }}
              />
              <div style={{ display: "flex", gap: "var(--py-space-2)", marginTop: "var(--py-space-2)" }}>
                <PillButton variant="primary" onClick={handleSaveEdit}>
                  Save
                </PillButton>
                <PillButton variant="ghost" onClick={cancelEdit}>
                  Cancel
                </PillButton>
              </div>
            </GlassCard>
          );
        }

        return (
          <div key={row.id} className="py-med-card">
            <div className="py-med-item">
              <MedIcon size={36} />
              <div className="py-med-item__info">
                <div className="py-med-item__name">{row.name}</div>
                <div className="py-med-item__dose">
                  {row.dose && `${row.dose} · `}
                  {row.schedule.join(", ")}
                  {reminderLabel ? ` · Remind ${reminderLabel}` : ""}
                </div>
              </div>
              <div className="py-med-item__actions">
                <RowMoreMenu
                  ariaLabel={`${row.name} options`}
                  editLabel="Edit"
                  deleteLabel="Remove"
                  onEdit={() => startEdit(row)}
                  onDelete={() => handleDelete(row.id, row.name)}
                />
                {status ? (
                  <span
                    style={{
                      fontSize: "var(--py-text-caption)",
                      color: status.action === "taken" ? "var(--py-success)" : "var(--py-ink-muted)",
                      fontWeight: 500,
                    }}
                  >
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

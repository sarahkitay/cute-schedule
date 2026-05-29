import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { CloseIcon } from "../Icons";
import { parseNutritionLabelText, scaleLabelMacrosForPortion } from "../nutritionLabelParser";
import {
  isNativeNutritionLabelScannerAvailable,
  launchNutritionLabelScan,
  pickNutritionLabelPhotoFromLibrary,
} from "../nutritionLabelScanner";

const PORTION_UNITS = [
  { id: "servings", label: "Servings" },
  { id: "cups", label: "Cups" },
  { id: "oz", label: "Oz" },
  { id: "grams", label: "Grams" },
];

function applyOcrToForm({ text, lines }, setters) {
  const preview = lines?.length ? lines.join("\n") : text;
  setters.setOcrPreview(preview);
  const parsed = parseNutritionLabelText(text);
  if (!parsed.macros) {
    setters.setPerServing(null);
    setters.setError(
      "Could not read protein, carbs, fat, or calories. Fill the frame with the Nutrition Facts panel and try again."
    );
    return false;
  }
  setters.setPerServing(parsed.macros);
  setters.setConfidence(parsed.confidence);
  setters.setEditProtein(String(parsed.macros.protein));
  setters.setEditCarbs(String(parsed.macros.carbs));
  setters.setEditFat(String(parsed.macros.fat));
  setters.setEditCalories(String(parsed.macros.calories));
  setters.setError("");
  return true;
}

export function NutritionLabelScanner({ open, onClose, onApply, initialOcr = null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ocrPreview, setOcrPreview] = useState("");
  const [perServing, setPerServing] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [foodName, setFoodName] = useState("");
  const [portionAmount, setPortionAmount] = useState("1");
  const [portionUnit, setPortionUnit] = useState("servings");
  const [editProtein, setEditProtein] = useState("");
  const [editCarbs, setEditCarbs] = useState("");
  const [editFat, setEditFat] = useState("");
  const [editCalories, setEditCalories] = useState("");

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setError("");
      setOcrPreview("");
      setPerServing(null);
      setConfidence(null);
      setFoodName("");
      setPortionAmount("1");
      setPortionUnit("servings");
      setEditProtein("");
      setEditCarbs("");
      setEditFat("");
      setEditCalories("");
      return;
    }
    if (initialOcr?.error) {
      setError(initialOcr.error);
      setPerServing(null);
      return;
    }
    if (initialOcr?.text) {
      applyOcrToForm(initialOcr, {
        setOcrPreview,
        setPerServing,
        setConfidence,
        setEditProtein,
        setEditCarbs,
        setEditFat,
        setEditCalories,
        setError,
      });
    }
  }, [open, initialOcr]);

  if (!open) return null;

  async function runOcr(fn) {
    setBusy(true);
    setError("");
    try {
      const { text, lines } = await fn();
      applyOcrToForm(
        { text, lines },
        {
          setOcrPreview,
          setPerServing,
          setConfidence,
          setEditProtein,
          setEditCarbs,
          setEditFat,
          setEditCalories,
          setError,
        }
      );
    } catch (e) {
      if (e?.code === "CANCELLED") return;
      setError(e?.message || "Scan failed. Try again with even lighting.");
    } finally {
      setBusy(false);
    }
  }

  function handleCamera() {
    runOcr(() => launchNutritionLabelScan());
  }

  function handleChoosePhoto() {
    runOcr(() => pickNutritionLabelPhotoFromLibrary());
  }

  function getScaledMacros() {
    const base = {
      protein: Math.round(Number(editProtein) || 0),
      carbs: Math.round(Number(editCarbs) || 0),
      fat: Math.round(Number(editFat) || 0),
      calories: Math.round(Number(editCalories) || 0),
      servingSize: perServing?.servingSize,
    };
    return scaleLabelMacrosForPortion(base, portionAmount, portionUnit);
  }

  function handleApply() {
    const scaled = getScaledMacros();
    if (scaled.protein + scaled.carbs + scaled.fat + scaled.calories <= 0) {
      setError("Enter valid macros before saving.");
      return;
    }
    const labelBits = [];
    if (foodName.trim()) labelBits.push(foodName.trim());
    if (perServing?.servingSize) labelBits.push(`label: ${perServing.servingSize}`);
    labelBits.push(`${portionAmount} ${portionUnit}`);
    onApply({
      food: labelBits.join(" · ") || "Scanned label",
      protein: scaled.protein,
      carbs: scaled.carbs,
      fat: scaled.fat,
      calories: scaled.calories,
      perServing,
      portion: { amount: portionAmount, unit: portionUnit },
    });
    onClose();
  }

  const scaledPreview = perServing ? getScaledMacros() : null;

  const overlay = (
    <div
      className="modal-overlay health-workout-overlay nutrition-label-scanner-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nutrition-label-scan-title"
      onClick={onClose}
    >
      <div className="modal health-workout-sheet nutrition-label-scanner-sheet surface-glass" onClick={(ev) => ev.stopPropagation()}>
        <div className="health-workout-sheet-head">
          <h3 id="nutrition-label-scan-title" className="health-workout-sheet-title">
            Scan nutrition label
          </h3>
          <button type="button" className="btn-icon" aria-label="Close" onClick={onClose}>
            <CloseIcon style={{ width: 22, height: 22 }} />
          </button>
        </div>

        <p className="health-subline nutrition-label-scanner-intro">
          Point your camera at the <strong>Nutrition Facts</strong> panel. We read protein, carbs, fat, and calories per serving, then you enter how much you had.
        </p>

        <div className="nutrition-label-scanner-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={handleCamera}>
            {busy ? "Reading label…" : isNativeNutritionLabelScannerAvailable() ? "Scan with camera" : "Camera (iOS app)"}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={handleChoosePhoto}>
            {busy ? "…" : "Choose photo"}
          </button>
        </div>

        {error ? <p className="nutrition-label-scanner-error">{error}</p> : null}

        {perServing ? (
          <div className="nutrition-label-scanner-results">
            <div className="nutrition-label-confidence">
              Read quality: <strong>{confidence === "high" ? "Strong" : confidence === "medium" ? "Good" : "Review values"}</strong>
              {perServing.servingSize ? (
                <span className="health-subline"> · Label serving: {perServing.servingSize}</span>
              ) : null}
            </div>

            <label className="quick-row health-field-stack">
              <span className="label">Food name (optional)</span>
              <input
                className="input health-input-constrained"
                value={foodName}
                onChange={(e) => setFoodName(e.target.value)}
                placeholder="e.g. Greek yogurt"
              />
            </label>

            <p className="label" style={{ marginBottom: 6 }}>
              Per serving on label (edit if needed)
            </p>
            <div className="health-calc-grid health-meal-macro-grid nutrition-label-macro-grid">
              {[
                ["Protein (g)", editProtein, setEditProtein],
                ["Carbs (g)", editCarbs, setEditCarbs],
                ["Fat (g)", editFat, setEditFat],
                ["Calories", editCalories, setEditCalories],
              ].map(([lbl, val, setVal]) => (
                <label key={lbl} className="quick-row">
                  <span className="label">{lbl}</span>
                  <input className="input" type="number" min={0} value={val} onChange={(e) => setVal(e.target.value)} />
                </label>
              ))}
            </div>

            <div className="nutrition-label-portion-block">
              <span className="label">How much did you have?</span>
              <div className="nutrition-label-portion-row">
                <input
                  className="input nutrition-label-portion-amount"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={portionAmount}
                  onChange={(e) => setPortionAmount(e.target.value)}
                />
                <select className="input nutrition-label-portion-unit" value={portionUnit} onChange={(e) => setPortionUnit(e.target.value)}>
                  {PORTION_UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
              {scaledPreview ? (
                <p className="health-subline nutrition-label-scaled-preview">
                  Logged totals: P {scaledPreview.protein}g · C {scaledPreview.carbs}g · F {scaledPreview.fat}g ·{" "}
                  {scaledPreview.calories} kcal
                </p>
              ) : null}
            </div>

            <div className="health-macro-actions-center">
              <button type="button" className="btn btn-primary" onClick={handleApply}>
                Add to meal log
              </button>
            </div>
          </div>
        ) : null}

        {ocrPreview && !perServing ? (
          <details className="nutrition-label-ocr-raw">
            <summary className="health-subline">Raw text (for troubleshooting)</summary>
            <pre>{ocrPreview}</pre>
          </details>
        ) : null}
      </div>
    </div>
  );

  if (typeof document === "undefined") return overlay;
  return ReactDOM.createPortal(overlay, document.body);
}

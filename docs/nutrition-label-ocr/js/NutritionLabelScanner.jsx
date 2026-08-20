import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { CloseIcon } from "../Icons";
import {
  parseNutritionLabelText,
  scaleLabelMacrosForPortion,
  shouldEnhanceLabelParse,
  formatLabelMacrosPreview,
} from "../nutritionLabelParser";
import {
  isNativeNutritionLabelScannerAvailable,
  launchNutritionLabelScan,
  pickNutritionLabelPhotoFromLibrary,
} from "../nutritionLabelScanner";
import { parseNutritionLabelWithCoachApi } from "../nutritionLabelCoachApi";

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error || new Error("Could not read image."));
    reader.readAsDataURL(blob);
  });
}

const PORTION_UNITS = [
  { id: "servings", label: "Servings" },
  { id: "cups", label: "Cups" },
  { id: "oz", label: "Oz" },
  { id: "grams", label: "Grams" },
];

function macrosFromNativePayload(nativeMacros) {
  if (!nativeMacros || typeof nativeMacros !== "object") return null;
  const calories = Math.round(Number(nativeMacros.calories) || 0);
  const protein = Math.round(Number(nativeMacros.protein) || 0);
  const fat = Math.round(Number(nativeMacros.fat) || 0);
  const carbs = Math.round(Number(nativeMacros.carbs) || 0);
  if (calories <= 0 && protein <= 0 && fat <= 0 && carbs <= 0) return null;
  const complete = calories > 0 && protein >= 0 && fat >= 0 && carbs >= 0;
  return {
    macros: { calories, protein, fat, carbs },
    confidence: complete ? "high" : "medium",
    nativeComplete: complete,
  };
}

async function applyOcrToForm({ text, lines, imageBase64, macros: nativeMacros }, setters) {
  const fromNative = macrosFromNativePayload(nativeMacros);
  let parsed = fromNative || parseNutritionLabelText(text || "");
  const needsApi =
    shouldEnhanceLabelParse(parsed, {
      hasImage: Boolean(imageBase64),
      nativeComplete: Boolean(fromNative?.nativeComplete),
    }) && (text?.trim() || imageBase64);
  if (needsApi) {
    try {
      const api = await parseNutritionLabelWithCoachApi({
        text: text?.trim() || undefined,
        imageBase64: imageBase64 || undefined,
      });
      if (api?.macros) {
        parsed = {
          macros: {
            ...parsed.macros,
            ...api.macros,
            protein: api.macros.protein ?? parsed.macros?.protein ?? 0,
            carbs: api.macros.carbs ?? parsed.macros?.carbs ?? 0,
            fat: api.macros.fat ?? parsed.macros?.fat ?? 0,
            calories: api.macros.calories ?? parsed.macros?.calories ?? 0,
            servingSize: api.macros.servingSize || parsed.macros?.servingSize,
          },
          confidence: api.confidence || "medium",
        };
        if (api.foodName) setters.setFoodName?.(api.foodName);
      }
    } catch (e) {
      if (!parsed.macros) {
        setters.setPerServing(null);
        setters.setError(
          e?.message || "Could not read the label. Center the Nutrition Facts panel and try again."
        );
        return false;
      }
    }
  }
  if (!parsed.macros) {
    setters.setPerServing(null);
    setters.setError(
      "Could not read calories, protein, fat, or carbs. Fill the frame with the Nutrition Facts panel and try again."
    );
    return false;
  }
  setters.setPerServing(parsed.macros);
  setters.setConfidence(parsed.confidence);
  setters.setOcrPreview(formatLabelMacrosPreview(parsed.macros));
  setters.setEditProtein(String(parsed.macros.protein ?? 0));
  setters.setEditCarbs(String(parsed.macros.carbs ?? 0));
  setters.setEditFat(String(parsed.macros.fat ?? 0));
  setters.setEditCalories(String(parsed.macros.calories ?? 0));
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
      void applyOcrToForm(initialOcr, {
        setOcrPreview,
        setPerServing,
        setConfidence,
        setEditProtein,
        setEditCarbs,
        setEditFat,
        setEditCalories,
        setError,
        setFoodName,
      });
    }
  }, [open, initialOcr]);

  if (!open) return null;

  async function runOcr(fn) {
    setBusy(true);
    setError("");
    try {
      const result = await fn();
      const { text, lines, macros: nativeMacros } = result;
      let imageBase64 = result.imageBase64;
      if (!imageBase64 && result.imageBlob) {
        const b64 = await blobToDataUrl(result.imageBlob);
        imageBase64 = b64;
      }
      await applyOcrToForm(
        { text, lines, imageBase64, macros: nativeMacros },
        {
          setOcrPreview,
          setPerServing,
          setConfidence,
          setEditProtein,
          setEditCarbs,
          setEditFat,
          setEditCalories,
          setError,
          setFoodName,
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
            Label scanner
          </h3>
          <button type="button" className="btn-icon" aria-label="Close" onClick={onClose}>
            <CloseIcon style={{ width: 22, height: 22 }} />
          </button>
        </div>

        <div className="nutrition-label-scan-frame" aria-hidden="true">
          <div className="nutrition-label-scan-frame-inner">
            <span className="nutrition-label-scan-frame-label">Nutrition Facts</span>
          </div>
        </div>

        <p className="health-subline nutrition-label-scanner-intro">
          On iPhone, <strong>Scan label</strong> opens a live scanner. For <strong>bottles and bags</strong>, wrap the label around the frame, avoid glare, and tap ● once we read your macros. We only save <strong>Calories</strong>, <strong>Protein</strong>, <strong>Fat</strong>, and <strong>Carbs</strong>.
        </p>

        <div className="nutrition-label-scanner-actions">
          <button type="button" className="btn btn-primary nutrition-label-scan-btn" disabled={busy} onClick={handleCamera}>
            {busy ? "Processing…" : isNativeNutritionLabelScannerAvailable() ? "Scan label" : "Scan label (iOS app)"}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={handleChoosePhoto}>
            {busy ? "…" : "Choose photo"}
          </button>
        </div>

        {error ? <p className="nutrition-label-scanner-error">{error}</p> : null}

        {ocrPreview && !error ? (
          <p className="nutrition-label-scanned-summary" role="status" aria-live="polite">
            {busy ? "Reading label…" : `Scanned: ${ocrPreview}`}
          </p>
        ) : null}

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
      </div>
    </div>
  );

  if (typeof document === "undefined") return overlay;
  return ReactDOM.createPortal(overlay, document.body);
}

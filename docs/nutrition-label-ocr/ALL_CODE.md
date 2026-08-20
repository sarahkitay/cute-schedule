# Nutrition Label OCR — Full Source Dump

Copy-paste package extracted from ProYou (`cute-schedule`).

> Prefer the individual files under `js/`, `api/`, `ios/`, and `css/` when porting.
> This file concatenates everything for easy search / archive.

See [README.md](./README.md) for architecture and integration steps.

---

## `js/nutritionLabelScanner.js`

```javascript
import { Capacitor, registerPlugin } from "@capacitor/core";

const ProyouNutritionLabel = registerPlugin("ProyouNutritionLabel");

export function isNativeNutritionLabelScannerAvailable() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

/**
 * @returns {Promise<{ text: string, lines: string[] }>}
 */
export async function scanNutritionLabelFromCamera() {
  if (!isNativeNutritionLabelScannerAvailable()) {
    const err = new Error("Label scanner requires the PROYOU iOS app on a device with a camera.");
    err.code = "LABEL_SCAN_IOS_ONLY";
    throw err;
  }
  const avail = await ProyouNutritionLabel.isAvailable();
  if (!avail?.available) {
    const err = new Error("Camera is not available on this device.");
    err.code = "NO_CAMERA";
    throw err;
  }
  return ProyouNutritionLabel.scanLabel();
}

/** Opens device camera (native) or camera capture picker (web), then OCRs the label. */
export function launchNutritionLabelScan() {
  if (isNativeNutritionLabelScannerAvailable()) {
    return scanNutritionLabelFromCamera();
  }
  return pickNutritionLabelPhotoFromCamera();
}

/** Opens photo library (native) or file picker without forcing camera (web). */
export function pickNutritionLabelPhotoFromLibrary() {
  if (isNativeNutritionLabelScannerAvailable()) {
    return ProyouNutritionLabel.pickLabelPhoto();
  }
  return pickNutritionLabelPhotoWeb();
}

function pickNutritionLabelPhotoFromCamera() {
  return pickNutritionLabelPhotoWeb({ preferCamera: true });
}

function pickNutritionLabelPhotoWeb({ preferCamera = false } = {}) {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (preferCamera) input.capture = "environment";
    input.style.display = "none";
    document.body.appendChild(input);
    const cleanup = () => input.remove();
    input.addEventListener(
      "change",
      async () => {
        const file = input.files?.[0];
        cleanup();
        if (!file) {
          const err = new Error("Cancelled");
          err.code = "CANCELLED";
          reject(err);
          return;
        }
        try {
          const ocr = await recognizeNutritionLabelImage(file);
          const imageBase64 = await blobToBase64(file);
          resolve({ ...ocr, imageBase64 });
        } catch (e) {
          reject(e);
        }
      },
      { once: true }
    );
    input.addEventListener(
      "cancel",
      () => {
        cleanup();
        const err = new Error("Cancelled");
        err.code = "CANCELLED";
        reject(err);
      },
      { once: true }
    );
    input.click();
  });
}

/**
 * @param {Blob} blob
 * @returns {Promise<{ text: string, lines: string[] }>}
 */
export async function recognizeNutritionLabelImage(blob) {
  const base64 = await blobToBase64(blob);
  if (isNativeNutritionLabelScannerAvailable()) {
    return ProyouNutritionLabel.recognizeImage({ base64 });
  }
  return recognizeWithTesseract(blob);
}

async function recognizeWithTesseract(blob) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: () => {},
  });
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: "4",
    });
    const {
      data: { text },
    } = await worker.recognize(blob);
    const lines = String(text || "")
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    return { text: lines.join("\n"), lines };
  } finally {
    await worker.terminate();
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") resolve(result);
      else reject(new Error("Could not read image."));
    };
    reader.onerror = () => reject(reader.error || new Error("Could not read image."));
    reader.readAsDataURL(blob);
  });
}
```

## `js/nutritionLabelParser.js`

```javascript
/**
 * Parse USDA-style Nutrition Facts OCR text into per-serving macros.
 * Tuned for Vision / Tesseract output from packaged food labels.
 */

function parseNum(raw) {
  if (raw == null || raw === "") return null;
  const cleaned = String(raw).replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!cleaned) return null;
  const val = Number(cleaned[0]);
  return Number.isFinite(val) ? val : null;
}

/** @typedef {{ protein: number, carbs: number, fat: number, calories: number, servingSize?: string, servingsPerContainer?: number }} LabelMacros */

/**
 * @param {string} text
 * @returns {{ macros: LabelMacros | null, confidence: 'high' | 'medium' | 'low', debug?: string[] }}
 */
/** Drop % DV noise and reorder garbled Vision rows before parsing. */
export function normalizeNutritionOcrText(text) {
  if (!text || typeof text !== "string") return "";
  const lines = text
    .replace(/\u00a0/g, " ")
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => {
      if (/^%?\s*daily\s*value/i.test(line)) return false;
      if (/^(\d+\s*%[\s]*)+$/i.test(line.replace(/\s+/g, " "))) return false;
      return true;
    });

  const flat = lines.join(" ");

  const headerCal = flat.match(/\b(\d{2,3})\s*%?\s*\*?\s*daily\s*value/i);
  const factsCal = flat.match(/nutrition\s*facts[\s\S]{0,200}?\bcalories\b[\s\S]{0,60}?\b(\d{2,3})\b/i);
  const looseCal = flat.match(/\bcalories\b[^0-9]{0,40}(\d{2,3})\b/i);
  let orphanCal = null;
  for (const line of lines) {
    const t = line.trim();
    if (/^\d{2,3}$/.test(t)) {
      const v = parseNum(t);
      if (v != null && v >= 50 && v <= 999) {
        orphanCal = v;
        break;
      }
    }
  }

  let caloriesLine = null;
  const cal =
    parseNum(headerCal?.[1]) ?? parseNum(looseCal?.[1]) ?? parseNum(factsCal?.[1]) ?? orphanCal;
  if (cal != null && cal >= 5 && cal <= 9999) {
    caloriesLine = `Calories ${cal}`;
  }

  const macroLines = [];
  const other = [];
  for (const line of lines) {
    const l = line.toLowerCase();
    if (/^nutrition\s*facts$/i.test(line)) continue;
    if (/^calories$/i.test(line) && caloriesLine) continue;
    if (/^calories\s+\d/i.test(line) || (l.includes("calories") && /\d{2,3}/.test(line))) {
      macroLines.push(caloriesLine || line);
      continue;
    }
    if (/total\s*fat\b/i.test(line) && !/saturated|trans|poly|mono/i.test(l)) {
      macroLines.push(line);
      continue;
    }
    if (/total\s*carb/i.test(line)) {
      macroLines.push(line);
      continue;
    }
    if (/^protein\b/i.test(line)) {
      macroLines.push(line);
      continue;
    }
    if (/serving\s*size|servings?\s*per/i.test(l)) other.push(line);
  }

  const ordered = [];
  if (/nutrition\s*facts/i.test(flat)) ordered.push("Nutrition Facts");
  if (caloriesLine) ordered.push(caloriesLine);
  ordered.push(...other, ...macroLines);
  if (!ordered.length) return lines.join("\n");
  return ordered.join("\n");
}

/** Atwater estimate when OCR drops the calorie row but macros are present. */
export function inferCaloriesFromMacros(protein, fat, carbs) {
  const p = protein ?? 0;
  const f = fat ?? 0;
  const c = carbs ?? 0;
  if (p <= 0 && f <= 0 && c <= 0) return null;
  const kcal = Math.round(p * 4 + f * 9 + c * 4);
  return kcal >= 5 && kcal <= 9999 ? kcal : null;
}

/** Human-readable summary of the four macros we care about. */
export function formatLabelMacrosPreview(macros) {
  if (!macros) return "";
  return [
    `Calories ${macros.calories ?? 0}`,
    `Protein ${macros.protein ?? 0}g`,
    `Total Fat ${macros.fat ?? 0}g`,
    `Total Carbs ${macros.carbs ?? 0}g`,
  ].join(" · ");
}

export function parseNutritionLabelText(text) {
  const debug = [];
  if (!text || typeof text !== "string") {
    return { macros: null, confidence: "low", debug };
  }

  const sourceLines = text
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const sourceFlat = sourceLines.join(" ");

  const raw = normalizeNutritionOcrText(text);
  const lines = raw
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const joined = lines.join("\n");
  const flat = lines.join(" ");

  let servingSize = null;
  let servingsPerContainer = null;

  const servingMatch =
    flat.match(/serving\s*size\s*[:\s]*([^(\n]+?)(?:\s*\(|$)/i) ||
    joined.match(/Serving size\s*\n\s*([^\n]+)/i);
  if (servingMatch) {
    servingSize = servingMatch[1].trim().slice(0, 80);
    debug.push(`serving: ${servingSize}`);
  }

  const spc = flat.match(/servings?\s*per\s*container\s*[:\s]*(\d+)/i);
  if (spc) servingsPerContainer = parseNum(spc[1]);

  let calories = extractCalories(flat, lines, debug) ?? extractCalories(sourceFlat, sourceLines, debug);
  const protein =
    extractLabelMacro(flat, lines, "protein", debug) ??
    extractLabelMacro(sourceFlat, sourceLines, "protein", debug);
  const fat =
    extractLabelMacro(flat, lines, "fat", debug) ?? extractLabelMacro(sourceFlat, sourceLines, "fat", debug);
  const carbs =
    extractLabelMacro(flat, lines, "carbs", debug) ?? extractLabelMacro(sourceFlat, sourceLines, "carbs", debug);

  if (calories == null) {
    const inferred = inferCaloriesFromMacros(protein, fat, carbs);
    if (inferred != null) {
      calories = inferred;
      debug.push(`calories (inferred): ${inferred}`);
    }
  }

  const found = [calories, protein, carbs, fat].filter((v) => v != null && v > 0).length;
  const hasCore =
    calories != null &&
    calories > 0 &&
    (protein != null || fat != null || carbs != null);
  if (found < 2 || !hasCore) {
    return { macros: null, confidence: "low", debug };
  }

  const macros = {
    calories: Math.round(calories || 0),
    protein: Math.round(protein || 0),
    carbs: Math.round(carbs || 0),
    fat: Math.round(fat || 0),
    ...(servingSize ? { servingSize } : {}),
    ...(servingsPerContainer != null ? { servingsPerContainer } : {}),
  };

  let confidence = "medium";
  if (found >= 4 && protein != null && fat != null && calories != null) confidence = "high";
  else if (found === 2 && calories != null) confidence = "low";

  return { macros, confidence, debug };
}

/** Whether local parse should be boosted by the server label reader. */
export function shouldEnhanceLabelParse(parsed, { hasImage = false, nativeComplete = false } = {}) {
  if (nativeComplete) return false;
  if (!parsed?.macros) return true;
  const { protein, fat, calories, carbs } = parsed.macros;
  if (
    parsed.confidence === "high" &&
    calories > 0 &&
    protein != null &&
    fat != null &&
    carbs != null
  ) {
    return false;
  }
  if (!hasImage) {
    if (calories == null || calories <= 0) return true;
    if (protein == null && fat == null) return true;
    if (protein == null || fat == null || carbs == null) return true;
    return parsed.confidence !== "high";
  }
  if (calories == null || calories <= 0) return true;
  if (protein == null || fat == null || carbs == null) return true;
  return parsed.confidence !== "high";
}

function extractCalories(flat, lines, debug) {
  const patterns = [
    /calories\s*[:\s]*(\d{2,4})\b/i,
    /(\d{2,4})\s*calories\b/i,
    /\bCalories\s+(\d{2,4})\b/,
    /\b(\d{2,3})\s*%?\s*\*?\s*Daily\s*Value/i,
    /nutrition\s*facts[\s\S]{0,200}?\b(\d{2,3})\b\s*%?\s*daily/i,
    /energy\s*[:\s]*(\d{2,4})\s*(?:kcal|cal)/i,
    /(?:^|\s)(\d{2,4})\s*(?:kcal|cal)\b/i,
  ];
  for (const re of patterns) {
    const m = flat.match(re);
    if (m) {
      const v = parseNum(m[1]);
      if (v != null && v >= 5 && v <= 9999) {
        debug.push(`calories: ${v}`);
        return v;
      }
    }
  }
  for (const line of lines) {
    if (/^\d{2,3}$/.test(line.trim())) {
      const v = parseNum(line);
      if (v != null && v >= 50 && v <= 800) {
        debug.push(`calories (orphan line): ${v}`);
        return v;
      }
    }
  }
  for (let i = 0; i < lines.length; i++) {
    if (/^calories$/i.test(lines[i])) {
      for (let j = 1; j <= 3 && i + j < lines.length; j++) {
        const v = parseNum(lines[i + j].replace(/[^\d.,]/g, ""));
        if (v != null && v >= 5 && v <= 9999) {
          debug.push(`calories (line+${j}): ${v}`);
          return v;
        }
      }
    }
    const inline = lines[i].match(/^calories\s*[:\s]*(\d{2,4})/i);
    if (inline) {
      debug.push(`calories (inline): ${inline[1]}`);
      return parseNum(inline[1]);
    }
    if (/nutrition\s*facts/i.test(lines[i]) && lines[i + 1]) {
      const v = parseNum(lines[i + 1]);
      if (v != null && v >= 50 && v <= 9999) {
        debug.push(`calories (after facts): ${v}`);
        return v;
      }
    }
  }
  return null;
}

/**
 * @param {'protein' | 'fat' | 'carbs'} kind
 */
function extractLabelMacro(flat, lines, kind, debug) {
  const configs = {
    protein: {
      label: "protein",
      flatPatterns: [
        /protein\s*[:\s]*(\d+(?:[.,]\d+)?)\s*g\b/i,
        /(\d+(?:[.,]\d+)?)\s*g\s*protein/i,
        /protein\s+(\d+(?:[.,]\d+)?)\b/i,
      ],
      lineRe: /^protein\b/i,
      combinedRe: /protein\s*(\d+(?:[.,]\d+)?)/i,
      max: 200,
    },
    fat: {
      label: "fat",
      flatPatterns: [
        /total\s*fat\s*[:\s]*(\d+(?:[.,]\d+)?)\s*g\b/i,
        /total\s*fat\s*[:\s]*(\d+(?:[.,]\d+)?)\b/i,
        /(?<!saturated\s)fat\s*[:\s]*(\d+(?:[.,]\d+)?)\s*g\b/i,
      ],
      lineRe: /^total\s*fat\b/i,
      combinedRe: /total\s*fat\s*(\d+(?:[.,]\d+)?)/i,
      max: 200,
    },
    carbs: {
      label: "carbs",
      flatPatterns: [
        /total\s*carb(?:ohydrate)?s?\s*[:\s]*(\d+(?:[.,]\d+)?)\s*g\b/i,
        /total\s*carb(?:ohydrate)?s?\s*[:\s]*(\d+(?:[.,]\d+)?)\b/i,
        /carb(?:ohydrate)?s?\s*[:\s]*(\d+(?:[.,]\d+)?)\s*g\b/i,
      ],
      lineRe: /^total\s*carb/i,
      combinedRe: /total\s*carb(?:ohydrate)?s?\s*(\d+(?:[.,]\d+)?)/i,
      max: 400,
    },
  };
  const cfg = configs[kind];
  for (const re of cfg.flatPatterns) {
    const m = flat.match(re);
    if (m) {
      const v = parseNum(m[1]);
      if (v != null && v >= 0 && v <= cfg.max) {
        debug.push(`${cfg.label}: ${v}`);
        return v;
      }
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (cfg.lineRe.test(line) || (kind === "protein" && /^protein$/i.test(line))) {
      const onLine = line.match(/(\d+(?:[.,]\d+)?)\s*g\b/i) || cfg.combinedRe.exec(line);
      if (onLine) {
        const v = parseNum(onLine[1]);
        if (v != null && v >= 0 && v <= cfg.max) {
          debug.push(`${cfg.label} (line): ${v}`);
          return v;
        }
      }
      for (let j = 1; j <= 2 && i + j < lines.length; j++) {
        const next = lines[i + j];
        if (/saturated|trans|dietary|sugar|includes/i.test(next) && kind === "fat") continue;
        const gm = next.match(/^(\d+(?:[.,]\d+)?)\s*g?\s*$/i) || next.match(/(\d+(?:[.,]\d+)?)\s*g\b/i);
        if (gm) {
          const v = parseNum(gm[1]);
          if (v != null && v >= 0 && v <= cfg.max) {
            debug.push(`${cfg.label} (next line): ${v}`);
            return v;
          }
        }
      }
    }
    const combined = cfg.combinedRe.exec(line);
    if (combined) {
      const v = parseNum(combined[1]);
      if (v != null && v >= 0 && v <= cfg.max) {
        debug.push(`${cfg.label} (combined): ${v}`);
        return v;
      }
    }
  }
  return null;
}

/**
 * Parse serving size text into measurable units for portion math.
 * @param {string | undefined} servingSize
 * @returns {{ cups?: number, oz?: number, grams?: number, servings?: number } | null}
 */
export function parseServingSizeUnits(servingSize) {
  if (!servingSize) return null;
  const s = servingSize.toLowerCase();
  const out = {};

  const cupFrac = s.match(/(\d+)\s*\/\s*(\d+)\s*cup/);
  const cupDec = s.match(/(\d+(?:[.,]\d+)?)\s*cup/);
  if (cupFrac) out.cups = Number(cupFrac[1]) / Number(cupFrac[2]);
  else if (cupDec) out.cups = parseNum(cupDec[1]);

  const ozM = s.match(/(\d+(?:[.,]\d+)?)\s*oz/);
  if (ozM) out.oz = parseNum(ozM[1]);

  const gM = s.match(/(\d+(?:[.,]\d+)?)\s*g\b/);
  if (gM) out.grams = parseNum(gM[1]);

  const servM = s.match(/(\d+(?:[.,]\d+)?)\s*serving/);
  if (servM) out.servings = parseNum(servM[1]);

  return Object.keys(out).length ? out : null;
}

/**
 * Multiply per-label macros by how much the user ate.
 * @param {LabelMacros} perServing
 * @param {number} amount
 * @param {'servings' | 'cups' | 'oz' | 'grams'} unit
 */
export function scaleLabelMacrosForPortion(perServing, amount, unit) {
  const amt = Math.max(0, Number(amount) || 0);
  if (amt <= 0) {
    return { protein: 0, carbs: 0, fat: 0, calories: 0 };
  }

  let multiplier = amt;
  const units = parseServingSizeUnits(perServing.servingSize);

  if (unit === "servings") {
    multiplier = amt;
  } else if (unit === "cups" && units?.cups) {
    multiplier = amt / units.cups;
  } else if (unit === "oz" && units?.oz) {
    multiplier = amt / units.oz;
  } else if (unit === "grams" && units?.grams) {
    multiplier = amt / units.grams;
  } else {
    multiplier = amt;
  }

  return {
    protein: Math.round((perServing.protein || 0) * multiplier),
    carbs: Math.round((perServing.carbs || 0) * multiplier),
    fat: Math.round((perServing.fat || 0) * multiplier),
    calories: Math.round((perServing.calories || 0) * multiplier),
  };
}
```

## `js/nutritionLabelCoachApi.js`

```javascript
import { apiUrl } from "./apiBase.js";

/**
 * Parse nutrition label via server (OpenAI vision / text) when local OCR parsing fails.
 * @param {{ text?: string, imageBase64?: string }} payload
 */
export async function parseNutritionLabelWithCoachApi(payload) {
  let res;
  try {
    res = await fetch(apiUrl("/api/nutrition-label"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    const msg = String(e?.message || "");
    throw new Error(
      msg === "Load failed" || msg === "Failed to fetch"
        ? "Could not reach the label reader. Your scan is still saved locally - edit the values below or try again on Wi‑Fi."
        : msg || "Network error while reading the label.",
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || "Could not read the label.");
    err.status = res.status;
    throw err;
  }
  return data;
}
```

## `js/NutritionLabelScanner.jsx`

```jsx
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
```

## `js/nutritionLabelParser.test.mjs`

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { parseNutritionLabelText, scaleLabelMacrosForPortion } from "./nutritionLabelParser.js";

test("parseNutritionLabelText reads standard FDA panel layout", () => {
  const text = `
Nutrition Facts
Serving size 2/3 cup (55g)
Calories 230
Total Fat 8g
Saturated Fat 1g
Total Carbohydrate 37g
Dietary Fiber 4g
Protein 3g
`;
  const { macros, confidence } = parseNutritionLabelText(text);
  assert.ok(macros);
  assert.equal(macros.calories, 230);
  assert.equal(macros.fat, 8);
  assert.equal(macros.carbs, 37);
  assert.equal(macros.protein, 3);
  assert.equal(confidence, "high");
});

test("parseNutritionLabelText handles jumbled two-column OCR (pretzel label)", () => {
  const text = `1% 0% 0% 17% 8% 7% 0% 0% 0% 2%
110 % Daily Value*
Nutrition Facts Serving size 1 oz (28g/about 16 pretzels) Includes 0g Added Sugars
8 servings per container Polyunsaturated Fat 0g Monounsaturated Fat 0g Total Carbohydrate 23g
Amount per serving Saturated Fat 0g Cholesterol Omg Dietary Fiber 2g Total Sugars <1g Vitamin D 0mcg Calcium 0mg
Calories Trans Fat 0g Sodium 400mg Protein 3g Iron 0.4mg
Total Fat 0.5g`;
  const { macros, confidence } = parseNutritionLabelText(text);
  assert.ok(macros);
  assert.equal(macros.calories, 110);
  assert.equal(macros.protein, 3);
  assert.equal(macros.carbs, 23);
  assert.equal(macros.fat, 1);
  assert.ok(confidence === "high" || confidence === "medium");
});

test("parseNutritionLabelText handles jumbled OCR without calorie digit (fiber label)", () => {
  const text = `Total Carbohydrate 42g Soluble Fiber 2g Insoluble Fiber 1g
Saturated Fat 0g Dietary Fiber 3g Total Sugars 1g
Serving size Amount Per Serving Calories Trans Fat 0g Cholesterol 0mg
Total Fat 1g Sodium 0mg Protein 7g`;
  const { macros, confidence } = parseNutritionLabelText(text);
  assert.ok(macros);
  assert.equal(macros.protein, 7);
  assert.equal(macros.fat, 1);
  assert.equal(macros.carbs, 42);
  assert.ok(macros.calories >= 200 && macros.calories <= 210);
  assert.ok(confidence === "high" || confidence === "medium");
});

test("scaleLabelMacrosForPortion by servings and cups", () => {
  const base = { calories: 200, protein: 10, carbs: 20, fat: 5, servingSize: "2/3 cup (55g)" };
  const two = scaleLabelMacrosForPortion(base, 2, "servings");
  assert.equal(two.calories, 400);
  assert.equal(two.protein, 20);
  const oneCup = scaleLabelMacrosForPortion(base, 1, "cups");
  assert.equal(oneCup.calories, 300);
});
```

## `api/nutrition-label.js`

```javascript
import { applyApiCors } from "./lib/cors.js";
import { clientSafeDetail, logServerError } from "./lib/safeJsonError.js";
import {
  assertNutritionLabelRateLimit,
  validateNutritionLabelPayload,
} from "./lib/nutritionLabelRateLimit.js";

const isProd = process.env.NODE_ENV === "production";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    applyApiCors(req, res);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST only" });
  }

  applyApiCors(req, res);
  res.setHeader("Content-Type", "application/json");

  const rate = await assertNutritionLabelRateLimit(req);
  if (!rate.ok) {
    res.setHeader("Retry-After", String(rate.retryAfterSec));
    return res.status(429).json({
      error: "Too many label scans. Please wait a moment and try again.",
      retryAfterSec: rate.retryAfterSec,
    });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return res.status(500).json(
      isProd ? { error: "Label reading service is not configured." } : { error: "Missing OPENAI_API_KEY" }
    );
  }

  try {
    const body = req.body || {};
    const payloadError = validateNutritionLabelPayload(body);
    if (payloadError) {
      return res.status(400).json({ error: payloadError });
    }

    const { text, imageBase64 } = body;
    const hasImage = typeof imageBase64 === "string" && imageBase64.length > 100;
    const hasText = typeof text === "string" && text.trim().length > 8;

    if (!hasImage && !hasText) {
      return res.status(400).json({ error: "Provide OCR text or imageBase64." });
    }

    const system = `You are a Nutrition Facts label reader for the FDA "Nutrition Facts" panel on packaged food.
Read the panel like a document scanner: ignore the % Daily Value column on the right; use only the nutrient amounts (grams/mg) on the left.
Extract ONLY the per-serving column (ignore per-container unless that is all that exists).
Required fields - find the number next to each label:
- calories (kcal, often the large number under "Calories")
- protein (grams, line labeled "Protein")
- total fat (grams, line labeled "Total Fat" - NOT saturated fat alone)
- total carbohydrate (grams, line labeled "Total Carbohydrate" or "Total Carbs")
Return JSON only: { "protein": number, "carbs": number, "fat": number, "calories": number, "servingSize": string|null, "foodName": string|null, "confidence": "high"|"medium"|"low" }
Round macros to whole numbers. If a value is missing on the label, use 0.`;

    /** @type {import('openai').default.ChatCompletionMessageParam[]} */
    const userContent = [];
    if (hasText) {
      userContent.push({ type: "text", text: `OCR text from nutrition label:\n\n${text.trim().slice(0, 12000)}` });
    }
    if (hasImage) {
      const raw = imageBase64.includes(",") ? imageBase64.split(",").pop() : imageBase64;
      const dataUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${raw}`;
      userContent.push({ type: "image_url", image_url: { url: dataUrl, detail: "high" } });
      if (!hasText) {
        userContent.unshift({
          type: "text",
          text: "Read the Nutrition Facts panel in this photo and extract per-serving macros.",
        });
      }
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: hasImage ? "gpt-4o-mini" : "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      logServerError("nutrition-label OpenAI", new Error(`${response.status} ${errBody.slice(0, 200)}`));
      return res.status(502).json({ error: "Could not read the label right now. Try again." });
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content || "{}";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: "Invalid response from label reader." });
    }

    const protein = Math.round(Number(parsed.protein) || 0);
    const carbs = Math.round(Number(parsed.carbs) || 0);
    const fat = Math.round(Number(parsed.fat) || 0);
    const calories = Math.round(Number(parsed.calories) || 0);
    if (protein + carbs + fat + calories <= 0) {
      return res.status(422).json({
        error: "Could not find protein, carbs, fat, or calories on this label.",
      });
    }

    return res.status(200).json({
      macros: {
        protein,
        carbs,
        fat,
        calories,
        ...(parsed.servingSize ? { servingSize: String(parsed.servingSize).slice(0, 80) } : {}),
      },
      foodName: parsed.foodName ? String(parsed.foodName).slice(0, 120) : null,
      confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "medium",
    });
  } catch (e) {
    logServerError("nutrition-label handler", e);
    return res.status(500).json({ error: clientSafeDetail(e, "Label read failed.") });
  }
}
```

## `api/nutritionLabelRateLimit.js`

```javascript
import { kv } from "./redisClient.js";
import { getCoachRateLimitClientId } from "./coachRateLimit.js";

const DEFAULT_MAX = 8;
const DEFAULT_WINDOW_SEC = 60;
const MAX_IMAGE_BASE64_LEN = 6_000_000;
const MAX_TEXT_LEN = 12_000;

/**
 * @returns {Promise<{ ok: true } | { ok: false; retryAfterSec: number }>}
 */
export async function assertNutritionLabelRateLimit(req) {
  const max = Math.max(
    1,
    Number.parseInt(process.env.NUTRITION_LABEL_RATE_LIMIT_MAX || String(DEFAULT_MAX), 10) || DEFAULT_MAX
  );
  const windowSec = Math.max(
    10,
    Number.parseInt(
      process.env.NUTRITION_LABEL_RATE_LIMIT_WINDOW_SEC || String(DEFAULT_WINDOW_SEC),
      10
    ) || DEFAULT_WINDOW_SEC
  );
  const id = getCoachRateLimitClientId(req);
  const windowId = Math.floor(Date.now() / (windowSec * 1000));
  const key = `nutrition:rl:${id}:${windowId}`;

  try {
    const count = await kv.incr(key);
    if (count === 1) await kv.expire(key, windowSec * 2);
    if (count > max) {
      const windowMs = windowSec * 1000;
      const elapsed = Date.now() % windowMs;
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
      return { ok: false, retryAfterSec };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

/**
 * @param {{ text?: string, imageBase64?: string }} body
 * @returns {string | null} error message if invalid
 */
export function validateNutritionLabelPayload(body) {
  const text = typeof body?.text === "string" ? body.text : "";
  const image = typeof body?.imageBase64 === "string" ? body.imageBase64 : "";
  if (text.length > MAX_TEXT_LEN) {
    return "OCR text is too long.";
  }
  if (image.length > MAX_IMAGE_BASE64_LEN) {
    return "Image is too large. Try a closer photo or lower resolution.";
  }
  return null;
}
```

## `ios/ProyouNutritionLabelPlugin.swift`

```swift
import Foundation
import Capacitor
import UIKit
import AVFoundation

/// Nutrition label OCR: live scanner UI + photo library fallback.
@objc(ProyouNutritionLabelPlugin)
public class ProyouNutritionLabelPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ProyouNutritionLabelPlugin"
    public let jsName = "ProyouNutritionLabel"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scanLabel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickLabelPhoto", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recognizeImage", returnType: CAPPluginReturnPromise),
    ]

    private var scanCall: CAPPluginCall?
    private var imagePicker: UIImagePickerController?
    private var liveScanner: NutritionLabelScannerViewController?

    @objc func isAvailable(_ call: CAPPluginCall) {
        let camera = UIImagePickerController.isSourceTypeAvailable(.camera)
        call.resolve([
            "available": camera,
            "visionOcr": true,
            "liveScanner": camera,
        ])
    }

    /// Full-screen live scanner with on-screen macro readout; single capture (no multi-page document scan).
    @objc func scanLabel(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
                call.reject("Camera is not available on this device.", "NO_CAMERA")
                return
            }
            switch AVCaptureDevice.authorizationStatus(for: .video) {
            case .authorized:
                self.presentLiveScanner(call)
            case .notDetermined:
                AVCaptureDevice.requestAccess(for: .video) { granted in
                    DispatchQueue.main.async {
                        if granted { self.presentLiveScanner(call) }
                        else {
                            call.reject(
                                "Allow camera access in Settings → PROYOU → Camera to scan nutrition labels.",
                                "PERMISSION_DENIED"
                            )
                        }
                    }
                }
            default:
                call.reject(
                    "Allow camera access in Settings → PROYOU → Camera to scan nutrition labels.",
                    "PERMISSION_DENIED"
                )
            }
        }
    }

    @objc func recognizeImage(_ call: CAPPluginCall) {
        guard let b64 = call.getString("base64"), !b64.isEmpty else {
            call.reject("Missing base64 image data.", "INVALID_ARGS")
            return
        }
        let raw = b64.contains(",") ? String(b64.split(separator: ",").last ?? "") : b64
        guard let data = Data(base64Encoded: raw, options: .ignoreUnknownCharacters),
              let image = UIImage(data: data) else {
            call.reject("Could not decode image.", "INVALID_IMAGE")
            return
        }
        NutritionLabelOcr.recognizeStrong(from: image) { result in
            DispatchQueue.main.async {
                switch result {
                case .failure(let err):
                    call.reject(err.localizedDescription, "OCR_FAILED")
                case .success(let ocr):
                    self.resolveOcrPayload(ocr: ocr, image: image, call: call)
                }
            }
        }
    }

    @objc func pickLabelPhoto(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            guard UIImagePickerController.isSourceTypeAvailable(.photoLibrary) else {
                call.reject("Photo library is not available on this device.", "NO_LIBRARY")
                return
            }
            self.presentImagePicker(sourceType: .photoLibrary, call: call)
        }
    }

    private func presentLiveScanner(_ call: CAPPluginCall) {
        scanCall = call
        let scanner = NutritionLabelScannerViewController()
        scanner.modalPresentationStyle = .fullScreen
        scanner.onComplete = { [weak self] payload in
            guard let self = self, let call = self.scanCall else { return }
            call.resolve(payload)
            self.cleanup()
        }
        scanner.onCancel = { [weak self] in
            self?.scanCall?.reject("Cancelled", "CANCELLED")
            self?.cleanup()
        }
        liveScanner = scanner
        bridge?.viewController?.present(scanner, animated: true)
    }

    private func presentImagePicker(sourceType: UIImagePickerController.SourceType, call: CAPPluginCall) {
        scanCall = call
        let picker = UIImagePickerController()
        picker.sourceType = sourceType
        picker.delegate = self
        picker.allowsEditing = false
        imagePicker = picker
        bridge?.viewController?.present(picker, animated: true)
    }

    private func cleanup() {
        scanCall = nil
        imagePicker = nil
        liveScanner = nil
    }

    private func resolveOcrPayload(ocr: (lines: [String], fullText: String), image: UIImage, call: CAPPluginCall) {
        var payload: [String: Any] = [
            "text": ocr.fullText,
            "lines": ocr.lines,
        ]
        if let jpeg = image.jpegData(compressionQuality: 0.82) {
            payload["imageBase64"] = "data:image/jpeg;base64," + jpeg.base64EncodedString()
        }
        let macros = NutritionLabelMacroParser.parse(text: ocr.fullText)
        if macros.foundCount >= 2 {
            payload["macros"] = [
                "calories": macros.calories ?? 0,
                "protein": macros.protein ?? 0,
                "fat": macros.fat ?? 0,
                "carbs": macros.carbs ?? 0,
            ]
        }
        call.resolve(payload)
        cleanup()
    }
}

extension ProyouNutritionLabelPlugin: UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    public func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true) { [weak self] in
            self?.scanCall?.reject("Cancelled", "CANCELLED")
            self?.cleanup()
        }
    }

    public func imagePickerController(
        _ picker: UIImagePickerController,
        didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
    ) {
        guard let call = scanCall else {
            picker.dismiss(animated: true)
            return
        }
        let image = (info[.originalImage] as? UIImage)
        picker.dismiss(animated: true) { [weak self] in
            guard let self = self, let image = image, let cgImage = image.cgImage else {
                call.reject("No photo captured.", "NO_IMAGE")
                self?.cleanup()
                return
            }
            NutritionLabelOcr.recognize(cgImage: cgImage, accurate: true, regionOfInterest: nil) { result in
                DispatchQueue.main.async {
                    switch result {
                    case .failure(let err):
                        call.reject(err.localizedDescription, "OCR_FAILED")
                        self.cleanup()
                    case .success(let ocr):
                        self.resolveOcrPayload(ocr: ocr, image: image, call: call)
                    }
                }
            }
        }
    }
}
```

## `ios/NutritionLabelOcr.swift`

```swift
import UIKit
import Vision

enum NutritionLabelOcr {
    /// Multi-pass OCR for bottle/bag/curved labels (contrast + perspective crops + merge).
    static func recognizeStrong(
        from image: UIImage,
        completion: @escaping (Result<(lines: [String], fullText: String), Error>) -> Void
    ) {
        let candidates = NutritionLabelImagePipeline.ocrCandidates(from: image)
        guard !candidates.isEmpty else {
            completion(.failure(NSError(domain: "NutritionLabelOcr", code: 3, userInfo: [NSLocalizedDescriptionKey: "Could not process image."])))
            return
        }
        var mergedLines: [String] = []
        var seenLine = Set<String>()
        let group = DispatchGroup()
        let lock = NSLock()
        var lastError: Error?

        for cg in candidates.prefix(6) {
            group.enter()
            recognize(cgImage: cg, accurate: true, regionOfInterest: nil) { result in
                defer { group.leave() }
                switch result {
                case .success(let parsed):
                    lock.lock()
                    for line in parsed.lines {
                        let key = line.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
                        if !key.isEmpty, seenLine.insert(key).inserted {
                            mergedLines.append(line)
                        }
                    }
                    lock.unlock()
                case .failure(let err):
                    lastError = err
                }
            }
        }

        group.notify(queue: .global(qos: .userInitiated)) {
            if mergedLines.isEmpty {
                completion(.failure(lastError ?? NSError(domain: "NutritionLabelOcr", code: 2, userInfo: [NSLocalizedDescriptionKey: "No text found on the label."])))
                return
            }
            mergedLines.sort { a, b in
                nutritionLineSortKey(a) < nutritionLineSortKey(b)
            }
            completion(.success((mergedLines, mergedLines.joined(separator: "\n"))))
        }
    }

    private static func nutritionLineSortKey(_ line: String) -> Int {
        let l = line.lowercased()
        if l.contains("nutrition") { return 0 }
        if l.contains("calories") { return 1 }
        if l.contains("serving") { return 2 }
        if l.contains("total fat") { return 3 }
        if l.contains("total carb") { return 4 }
        if l.contains("protein") { return 5 }
        return 10
    }

    static func recognize(
        cgImage: CGImage,
        accurate: Bool,
        regionOfInterest: CGRect? = nil,
        completion: @escaping (Result<(lines: [String], fullText: String), Error>) -> Void
    ) {
        let request = VNRecognizeTextRequest { req, err in
            if let err = err {
                completion(.failure(err))
                return
            }
            guard let observations = req.results as? [VNRecognizedTextObservation] else {
                completion(.failure(NSError(domain: "NutritionLabelOcr", code: 1, userInfo: [NSLocalizedDescriptionKey: "No text found."])))
                return
            }
            let parsed = assembleOcrLines(from: observations)
            if parsed.lines.isEmpty {
                completion(.failure(NSError(domain: "NutritionLabelOcr", code: 2, userInfo: [NSLocalizedDescriptionKey: "No text found."])))
                return
            }
            completion(.success(parsed))
        }
        request.recognitionLevel = accurate ? .accurate : .fast
        request.usesLanguageCorrection = false
        request.recognitionLanguages = ["en-US"]
        request.minimumTextHeight = accurate ? 0.005 : 0.01
        request.customWords = [
            "Nutrition", "Facts", "Calories", "Protein", "Carbohydrate", "Carbohydrates",
            "Fat", "Sodium", "Serving", "Daily", "Value", "Fiber", "Sugars",
        ]
        if let roi = regionOfInterest {
            request.regionOfInterest = roi
        }

        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try handler.perform([request])
            } catch {
                completion(.failure(error))
            }
        }
    }

    static func assembleOcrLines(from observations: [VNRecognizedTextObservation]) -> (lines: [String], fullText: String) {
        struct Row {
            var y: CGFloat
            var parts: [(x: CGFloat, text: String)]
        }
        var rows: [Row] = []
        let yThreshold: CGFloat = 0.022
        let columnSplit: CGFloat = 0.52

        for obs in observations {
            guard let candidate = obs.topCandidates(1).first else { continue }
            let text = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
            if text.isEmpty { continue }
            let box = obs.boundingBox
            let cy = box.midY
            let cx = box.minX
            if let idx = rows.firstIndex(where: { abs($0.y - cy) < yThreshold }) {
                rows[idx].parts.append((cx, text))
                rows[idx].y = (rows[idx].y + cy) / 2
            } else {
                rows.append(Row(y: cy, parts: [(cx, text)]))
            }
        }

        rows.sort { $0.y > $1.y }
        var lines: [String] = []
        for var row in rows {
            row.parts.sort { $0.x < $1.x }
            let left = row.parts.filter { $0.x < columnSplit }.map(\.text)
            let right = row.parts.filter { $0.x >= columnSplit }.map(\.text).joined(separator: " ")
            let leftJoined = left.joined(separator: " ")
            let line: String
            if !left.isEmpty && isMostlyPercentColumn(right) {
                line = leftJoined
            } else if !leftJoined.isEmpty && isStandaloneCalorieAmount(right) {
                line = leftJoined.lowercased().contains("calories") ? "\(leftJoined) \(right)" : leftJoined
            } else if leftJoined.isEmpty && isStandaloneCalorieAmount(right) {
                line = "Calories \(right)"
            } else if !left.isEmpty && !right.isEmpty {
                line = "\(leftJoined) \(right)"
            } else {
                line = row.parts.map(\.text).joined(separator: " ")
            }
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty || isPercentOnlyLine(trimmed) { continue }
            lines.append(trimmed)
        }
        return (lines, lines.joined(separator: "\n"))
    }

    private static func isStandaloneCalorieAmount(_ text: String) -> Bool {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.range(of: #"^\d{2,4}$"#, options: .regularExpression) != nil
    }

    private static func isMostlyPercentColumn(_ text: String) -> Bool {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if t.isEmpty { return false }
        if t.range(of: #"^\d+\s*%(\s+\d+\s*%)*$"#, options: .regularExpression) != nil { return true }
        let tokens = t.split(separator: " ").map(String.init)
        if tokens.isEmpty { return false }
        let pct = tokens.filter { $0.hasSuffix("%") || $0 == "0%" }.count
        return Double(pct) / Double(tokens.count) >= 0.55
    }

    private static func isPercentOnlyLine(_ line: String) -> Bool {
        let lower = line.lowercased()
        if lower.contains("daily value") && !lower.contains("calories") && !lower.contains("fat") {
            return true
        }
        return isMostlyPercentColumn(line)
    }
}
```

## `ios/NutritionLabelMacroParser.swift`

```swift
import Foundation

struct NutritionLabelMacros {
    var calories: Int?
    var protein: Int?
    var fat: Int?
    var carbs: Int?

    var foundCount: Int {
        [calories, protein, fat, carbs].compactMap { $0 }.filter { $0 > 0 }.count
    }

    var isComplete: Bool {
        calories != nil && calories! > 0 && protein != nil && fat != nil && carbs != nil
    }
}

enum NutritionLabelMacroParser {
    static func parse(text: String) -> NutritionLabelMacros {
        let lines = text
            .components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        let flat = lines.joined(separator: " ")

        var calories = firstMatchInt(
            in: flat,
            patterns: [
                #"(?i)calories\s*[:\s]*(\d{2,4})\b"#,
                #"(?i)\bcalories\s+(\d{2,4})\b"#,
                #"(?i)calories\b[^0-9]{0,40}(\d{2,3})\b"#,
                #"(?i)\b(\d{2,3})\s*%?\s*\*?\s*daily\s*value"#,
            ],
            min: 5,
            max: 9999
        )
        if calories == nil {
            for line in lines where line.range(of: #"^\d{2,3}$"#, options: .regularExpression) != nil {
                if let v = parseNum(line), v >= 50 && v <= 800 {
                    calories = v
                    break
                }
            }
        }

        let protein = firstMatchInt(
            in: flat,
            patterns: [
                #"(?i)protein\s*[:\s]*(\d+(?:[.,]\d+)?)\s*g?\b"#,
                #"(?i)protein\s+(\d+(?:[.,]\d+)?)\b"#,
            ],
            min: 0,
            max: 200
        ) ?? lineMacro(lines: lines, prefixes: ["protein"], max: 200)

        let fat = firstMatchInt(
            in: flat,
            patterns: [
                #"(?i)total\s*fat\s*[:\s]*(\d+(?:[.,]\d+)?)\s*g?\b"#,
                #"(?i)total\s*fat\s*[:\s]*(\d+(?:[.,]\d+)?)\b"#,
            ],
            min: 0,
            max: 200
        ) ?? lineMacro(lines: lines, prefixes: ["total fat"], max: 200)

        let carbs = firstMatchInt(
            in: flat,
            patterns: [
                #"(?i)total\s*carb(?:ohydrate)?s?\s*[:\s]*(\d+(?:[.,]\d+)?)\s*g?\b"#,
                #"(?i)total\s*carb(?:ohydrate)?s?\s*[:\s]*(\d+(?:[.,]\d+)?)\b"#,
            ],
            min: 0,
            max: 400
        ) ?? lineMacro(lines: lines, prefixes: ["total carb"], max: 400)

        var calOut = calories
        if calOut == nil, let p = protein, let f = fat, let c = carbs {
            let inferred = Int(round(Double(p) * 4 + Double(f) * 9 + Double(c) * 4))
            if inferred >= 5 && inferred <= 9999 { calOut = inferred }
        }

        return NutritionLabelMacros(calories: calOut, protein: protein, fat: fat, carbs: carbs)
    }

    private static func parseNum(_ raw: String) -> Int? {
        let cleaned = raw.replacingOccurrences(of: ",", with: ".")
        guard let m = cleaned.range(of: #"\d+(?:\.\d+)?"#, options: .regularExpression) else { return nil }
        guard let val = Double(cleaned[m]), val.isFinite else { return nil }
        return Int(round(val))
    }

    private static func firstMatchInt(in text: String, patterns: [String], min: Int, max: Int) -> Int? {
        for p in patterns {
            guard let re = try? NSRegularExpression(pattern: p) else { continue }
            let range = NSRange(text.startIndex..., in: text)
            guard let match = re.firstMatch(in: text, range: range), match.numberOfRanges > 1,
                  let r = Range(match.range(at: 1), in: text),
                  let v = parseNum(String(text[r])), v >= min && v <= max else { continue }
            return v
        }
        return nil
    }

    private static func lineMacro(lines: [String], prefixes: [String], max: Int) -> Int? {
        for line in lines {
            let lower = line.lowercased()
            guard prefixes.contains(where: { lower.contains($0) }) else { continue }
            guard let re = try? NSRegularExpression(pattern: #"(\d+(?:[.,]\d+)?)"#),
                  let match = re.firstMatch(in: line, range: NSRange(line.startIndex..., in: line)),
                  let r = Range(match.range(at: 1), in: line),
                  let v = parseNum(String(line[r])), v >= 0 && v <= max else { continue }
            return v
        }
        return nil
    }
}
```

## `ios/NutritionLabelImagePipeline.swift`

```swift
import UIKit
import CoreImage
import Vision

/// Prepares curved / bag / bottle label photos for stronger Vision OCR.
enum NutritionLabelImagePipeline {
    private static let ciContext = CIContext(options: [.useSoftwareRenderer: false])

    /// Returns CGImages to OCR (original + enhanced variants), best first.
    static func ocrCandidates(from image: UIImage) -> [CGImage] {
        guard let base = image.cgImage ?? renderCGImage(from: image) else { return [] }
        var out: [CGImage] = []
        var seen = Set<Int>()

        func append(_ cg: CGImage?) {
            guard let cg = cg else { return }
            let key = cg.width ^ (cg.height << 16)
            if seen.insert(key).inserted { out.append(cg) }
        }

        append(base)
        if let cropped = cropToLargestRectangle(in: base) { append(cropped) }
        if let panel = cropToGuideAspect(from: base) { append(panel) }

        let ci = CIImage(cgImage: base)
        append(render(ci.applyHighContrast()))
        append(render(ci.applySharpen()))
        append(render(ci.applyHighContrast().applySharpen()))

        if let cropped = cropToLargestRectangle(in: base) {
            let cci = CIImage(cgImage: cropped)
            append(render(cci.applyHighContrast()))
        }

        return out
    }

    private static func renderCGImage(from image: UIImage) -> CGImage? {
        UIGraphicsBeginImageContextWithOptions(image.size, true, 1)
        image.draw(in: CGRect(origin: .zero, size: image.size))
        let result = UIGraphicsGetImageFromCurrentImageContext()?.cgImage
        UIGraphicsEndImageContext()
        return result
    }

    private static func render(_ ci: CIImage?) -> CGImage? {
        guard let ci = ci else { return nil }
        return ciContext.createCGImage(ci, from: ci.extent)
    }

    private static func cropToGuideAspect(from cg: CGImage) -> CGImage? {
        let w = CGFloat(cg.width)
        let h = CGFloat(cg.height)
        let targetAspect: CGFloat = 3 / 4
        var cropW = w * 0.88
        var cropH = cropW / targetAspect
        if cropH > h * 0.92 {
            cropH = h * 0.92
            cropW = cropH * targetAspect
        }
        let x = (w - cropW) / 2
        let y = h * 0.12
        return cg.cropping(to: CGRect(x: x, y: y, width: cropW, height: cropH))
    }

    private static func cropToLargestRectangle(in cg: CGImage) -> CGImage? {
        let request = VNDetectRectanglesRequest()
        request.minimumAspectRatio = 0.25
        request.maximumAspectRatio = 1.2
        request.minimumSize = 0.2
        request.maximumObservations = 6
        request.minimumConfidence = 0.45

        let handler = VNImageRequestHandler(cgImage: cg, options: [:])
        guard (try? handler.perform([request])) != nil,
              let rects = request.results,
              !rects.isEmpty else { return nil }

        let best = rects.max { a, b in
            rectArea(a) < rectArea(b)
        }!
        return perspectiveCorrect(cg: cg, observation: best) ?? nil
    }

    private static func rectArea(_ r: VNRectangleObservation) -> CGFloat {
        let w = hypot(r.topRight.x - r.topLeft.x, r.topRight.y - r.topLeft.y)
        let h = hypot(r.bottomLeft.x - r.topLeft.x, r.bottomLeft.y - r.topLeft.y)
        return w * h
    }

    private static func perspectiveCorrect(cg: CGImage, observation: VNRectangleObservation) -> CGImage? {
        let w = CGFloat(cg.width)
        let h = CGFloat(cg.height)
        func pt(_ p: CGPoint) -> CGPoint { CGPoint(x: p.x * w, y: (1 - p.y) * h) }
        let tl = pt(observation.topLeft)
        let tr = pt(observation.topRight)
        let bl = pt(observation.bottomLeft)
        let br = pt(observation.bottomRight)

        let ci = CIImage(cgImage: cg)
        let corrected = ci.applyingFilter("CIPerspectiveCorrection", parameters: [
            "inputTopLeft": CIVector(cgPoint: tl),
            "inputTopRight": CIVector(cgPoint: tr),
            "inputBottomLeft": CIVector(cgPoint: bl),
            "inputBottomRight": CIVector(cgPoint: br),
        ])
        return render(corrected)
    }
}

private extension CIImage {
    func applyHighContrast() -> CIImage {
        let controls = applyingFilter("CIColorControls", parameters: [
            kCIInputContrastKey: 1.35,
            kCIInputBrightnessKey: 0.04,
            kCIInputSaturationKey: 0.0,
        ])
        return controls.applyingFilter("CIExposureAdjust", parameters: [kCIInputEVKey: 0.35])
    }

    func applySharpen() -> CIImage {
        applyingFilter("CISharpenLuminance", parameters: [kCIInputSharpnessKey: 0.65])
    }
}
```

## `ios/NutritionLabelScannerViewController.swift`

```swift
import UIKit
import AVFoundation
import Vision

/// Full-screen live nutrition label scanner with on-screen macro readout and single capture.
final class NutritionLabelScannerViewController: UIViewController {
    var onComplete: (([String: Any]) -> Void)?
    var onCancel: (() -> Void)?

    private let session = AVCaptureSession()
    private var previewLayer: AVCaptureVideoPreviewLayer!
    private let photoOutput = AVCapturePhotoOutput()
    private let videoOutput = AVCaptureVideoDataOutput()
    private let videoQueue = DispatchQueue(label: "proyou.nutrition.scan.video", qos: .userInitiated)

    private var isLiveOcrBusy = false
    private var isProcessingCapture = false
    private var lastLiveOcrAt: TimeInterval = 0
    private let liveOcrInterval: TimeInterval = 0.85

    private let overlayView = UIView()
    private let guideView = UIView()
    private let statusLabel = UILabel()
    private let processingView = UIVisualEffectView(effect: UIBlurEffect(style: .dark))
    private let processingLabel = UILabel()

    private let calCell = MacroHudView(title: "Cal")
    private let proCell = MacroHudView(title: "Pro")
    private let fatCell = MacroHudView(title: "Fat")
    private let carbCell = MacroHudView(title: "Carb")

    private let captureButton = UIButton(type: .system)
    private let cancelButton = UIButton(type: .system)

    override var prefersStatusBarHidden: Bool { true }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        setupPreview()
        setupOverlay()
        setupControls()
        requestCameraAccess()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
        layoutGuideFrame()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        if session.isRunning { session.stopRunning() }
    }

    private func setupPreview() {
        previewLayer = AVCaptureVideoPreviewLayer(session: session)
        previewLayer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(previewLayer)
    }

    private func setupOverlay() {
        overlayView.backgroundColor = UIColor.black.withAlphaComponent(0.35)
        overlayView.isUserInteractionEnabled = false
        view.addSubview(overlayView)

        guideView.backgroundColor = .clear
        guideView.layer.borderColor = UIColor.white.withAlphaComponent(0.85).cgColor
        guideView.layer.borderWidth = 2
        guideView.layer.cornerRadius = 10
        view.addSubview(guideView)

        statusLabel.text = "Align Nutrition Facts in frame"
        statusLabel.textColor = .white
        statusLabel.font = .systemFont(ofSize: 15, weight: .semibold)
        statusLabel.textAlignment = .center
        statusLabel.numberOfLines = 2
        view.addSubview(statusLabel)

        let hud = UIStackView(arrangedSubviews: [calCell, proCell, fatCell, carbCell])
        hud.axis = .horizontal
        hud.distribution = .fillEqually
        hud.spacing = 8
        hud.translatesAutoresizingMaskIntoConstraints = false
        hud.backgroundColor = UIColor.black.withAlphaComponent(0.55)
        hud.layer.cornerRadius = 14
        hud.isLayoutMarginsRelativeArrangement = true
        hud.layoutMargins = UIEdgeInsets(top: 10, left: 10, bottom: 10, right: 10)
        hud.tag = 8801
        view.addSubview(hud)

        processingView.isHidden = true
        processingView.layer.cornerRadius = 16
        processingView.clipsToBounds = true
        processingLabel.text = "Processing label…"
        processingLabel.textColor = .white
        processingLabel.font = .systemFont(ofSize: 17, weight: .semibold)
        processingLabel.textAlignment = .center
        processingView.contentView.addSubview(processingLabel)
        view.addSubview(processingView)

        NSLayoutConstraint.activate([
            hud.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            hud.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            hud.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -100),

            processingView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            processingView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            processingView.widthAnchor.constraint(equalToConstant: 240),
            processingView.heightAnchor.constraint(equalToConstant: 88),
            processingLabel.centerXAnchor.constraint(equalTo: processingView.contentView.centerXAnchor),
            processingLabel.centerYAnchor.constraint(equalTo: processingView.contentView.centerYAnchor),
        ])
    }

    private func setupControls() {
        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.setTitleColor(.white, for: .normal)
        cancelButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .medium)
        cancelButton.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        cancelButton.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(cancelButton)

        captureButton.backgroundColor = .white
        captureButton.layer.cornerRadius = 34
        captureButton.layer.borderWidth = 4
        captureButton.layer.borderColor = UIColor.white.withAlphaComponent(0.5).cgColor
        captureButton.translatesAutoresizingMaskIntoConstraints = false
        captureButton.addTarget(self, action: #selector(captureTapped), for: .touchUpInside)
        view.addSubview(captureButton)

        NSLayoutConstraint.activate([
            cancelButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
            cancelButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            captureButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            captureButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -24),
            captureButton.widthAnchor.constraint(equalToConstant: 68),
            captureButton.heightAnchor.constraint(equalToConstant: 68),
        ])
    }

    private func layoutGuideFrame() {
        let w = view.bounds.width
        let h = view.bounds.height
        let guideW = w * 0.82
        let guideH = min(h * 0.48, guideW * 1.25)
        let guideX = (w - guideW) / 2
        let guideY = h * 0.22
        guideView.frame = CGRect(x: guideX, y: guideY, width: guideW, height: guideH)
        overlayView.frame = view.bounds
        punchGuideHole()
        statusLabel.frame = CGRect(x: 20, y: guideY - 44, width: w - 40, height: 40)
    }

    private func punchGuideHole() {
        let path = UIBezierPath(rect: overlayView.bounds)
        let hole = UIBezierPath(roundedRect: guideView.frame, cornerRadius: 10)
        path.append(hole)
        path.usesEvenOddFillRule = true
        let mask = CAShapeLayer()
        mask.path = path.cgPath
        mask.fillRule = .evenOdd
        overlayView.layer.mask = mask
    }

    private func guideRegionOfInterest() -> CGRect {
        guard let previewLayer = previewLayer else { return CGRect(x: 0.05, y: 0.1, width: 0.9, height: 0.75) }
        let rect = previewLayer.metadataOutputRectConverted(fromLayerRect: guideView.frame)
        return CGRect(
            x: max(0, min(1, rect.origin.x)),
            y: max(0, min(1, rect.origin.y)),
            width: max(0.2, min(1, rect.width)),
            height: max(0.2, min(1, rect.height))
        )
    }

    private func requestCameraAccess() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            configureSession()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    if granted { self?.configureSession() }
                    else { self?.failPermission() }
                }
            }
        default:
            failPermission()
        }
    }

    private func failPermission() {
        statusLabel.text = "Allow camera in Settings → PROYOU → Camera"
    }

    private func configureSession() {
        session.beginConfiguration()
        session.sessionPreset = .photo

        guard
            let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
            let input = try? AVCaptureDeviceInput(device: device),
            session.canAddInput(input)
        else {
            statusLabel.text = "Camera unavailable"
            session.commitConfiguration()
            return
        }
        session.addInput(input)

        if session.canAddOutput(photoOutput) { session.addOutput(photoOutput) }

        videoOutput.alwaysDiscardsLateVideoFrames = true
        videoOutput.setSampleBufferDelegate(self, queue: videoQueue)
        if session.canAddOutput(videoOutput) { session.addOutput(videoOutput) }

        session.commitConfiguration()
        videoQueue.async { [weak self] in
            self?.session.startRunning()
        }
    }

    private func updateHud(_ macros: NutritionLabelMacros) {
        calCell.setValue(macros.calories)
        proCell.setValue(macros.protein)
        fatCell.setValue(macros.fat)
        carbCell.setValue(macros.carbs)
        if macros.isComplete {
            statusLabel.text = "Tap ● to capture · all macros found"
        } else if macros.foundCount > 0 {
            statusLabel.text = "Reading… \(macros.foundCount)/4 · hold steady"
        } else {
            statusLabel.text = "Align Nutrition Facts in frame"
        }
    }

    private func runLiveOcr(on pixelBuffer: CVPixelBuffer) {
        let now = CACurrentMediaTime()
        guard !isLiveOcrBusy, !isProcessingCapture, now - lastLiveOcrAt >= liveOcrInterval else { return }
        isLiveOcrBusy = true
        lastLiveOcrAt = now
        let roi = guideRegionOfInterest()
        let request = VNRecognizeTextRequest { [weak self] req, _ in
            defer { self?.isLiveOcrBusy = false }
            guard let self = self, !self.isProcessingCapture else { return }
            guard let observations = req.results as? [VNRecognizedTextObservation] else { return }
            let parsed = NutritionLabelOcr.assembleOcrLines(from: observations)
            let macros = NutritionLabelMacroParser.parse(text: parsed.fullText)
            DispatchQueue.main.async { self.updateHud(macros) }
        }
        request.recognitionLevel = .fast
        request.usesLanguageCorrection = false
        request.recognitionLanguages = ["en-US"]
        request.minimumTextHeight = 0.012
        request.regionOfInterest = roi
        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .right, options: [:])
        try? handler.perform([request])
    }

    private func finishWithImage(_ image: UIImage) {
        guard let cgImage = image.cgImage else {
            statusLabel.text = "Could not process image"
            isProcessingCapture = false
            processingView.isHidden = true
            return
        }
        let uiImage = UIImage(cgImage: cgImage)
        NutritionLabelOcr.recognizeStrong(from: uiImage) { [weak self] result in
            guard let self = self else { return }
            DispatchQueue.main.async {
                self.processingView.isHidden = true
                self.isProcessingCapture = false
                switch result {
                case .failure(let err):
                    self.statusLabel.text = err.localizedDescription
                case .success(let ocr):
                    let macros = NutritionLabelMacroParser.parse(text: ocr.fullText)
                    var payload: [String: Any] = [
                        "text": ocr.fullText,
                        "lines": ocr.lines,
                    ]
                    if let jpeg = image.jpegData(compressionQuality: 0.85) {
                        payload["imageBase64"] = "data:image/jpeg;base64," + jpeg.base64EncodedString()
                    }
                    if macros.foundCount >= 2 {
                        payload["macros"] = [
                            "calories": macros.calories ?? 0,
                            "protein": macros.protein ?? 0,
                            "fat": macros.fat ?? 0,
                            "carbs": macros.carbs ?? 0,
                        ]
                    }
                    self.dismiss(animated: true) {
                        self.onComplete?(payload)
                    }
                }
            }
        }
    }

    @objc private func cancelTapped() {
        dismiss(animated: true) { [weak self] in
            self?.onCancel?()
        }
    }

    @objc private func captureTapped() {
        guard !isProcessingCapture, photoOutput.connection(with: .video) != nil else { return }
        isProcessingCapture = true
        processingView.isHidden = false
        statusLabel.text = "Processing…"
        photoOutput.capturePhoto(with: AVCapturePhotoSettings(), delegate: self)
    }
}

extension NutritionLabelScannerViewController: AVCaptureVideoDataOutputSampleBufferDelegate {
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        runLiveOcr(on: pixelBuffer)
    }
}

extension NutritionLabelScannerViewController: AVCapturePhotoCaptureDelegate {
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        if let error = error {
            DispatchQueue.main.async { [weak self] in
                self?.processingView.isHidden = true
                self?.isProcessingCapture = false
                self?.statusLabel.text = error.localizedDescription
            }
            return
        }
        guard let data = photo.fileDataRepresentation(), let image = UIImage(data: data) else {
            DispatchQueue.main.async { [weak self] in
                self?.processingView.isHidden = true
                self?.isProcessingCapture = false
                self?.statusLabel.text = "Capture failed"
            }
            return
        }
        finishWithImage(image.normalizedUpOrientation())
    }
}

private extension UIImage {
    func normalizedUpOrientation() -> UIImage {
        if imageOrientation == .up { return self }
        UIGraphicsBeginImageContextWithOptions(size, false, scale)
        draw(in: CGRect(origin: .zero, size: size))
        let normalized = UIGraphicsGetImageFromCurrentImageContext()
        UIGraphicsEndImageContext()
        return normalized ?? self
    }
}

// MARK: - Macro HUD cell

private final class MacroHudView: UIView {
    private let titleLabel = UILabel()
    private let valueLabel = UILabel()

    init(title: String) {
        super.init(frame: .zero)
        titleLabel.text = title
        titleLabel.font = .systemFont(ofSize: 11, weight: .semibold)
        titleLabel.textColor = UIColor.white.withAlphaComponent(0.7)
        titleLabel.textAlignment = .center

        valueLabel.text = "-"
        valueLabel.font = .monospacedDigitSystemFont(ofSize: 22, weight: .bold)
        valueLabel.textColor = .white
        valueLabel.textAlignment = .center

        let stack = UIStackView(arrangedSubviews: [titleLabel, valueLabel])
        stack.axis = .vertical
        stack.spacing = 2
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor),
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func setValue(_ n: Int?) {
        guard let n = n, n > 0 else {
            valueLabel.text = "-"
            valueLabel.textColor = UIColor.white.withAlphaComponent(0.35)
            return
        }
        valueLabel.text = "\(n)"
        valueLabel.textColor = UIColor(red: 0.45, green: 0.92, blue: 0.72, alpha: 1)
    }
}
```

## `css/nutrition-label-scanner.css`

```css
.nutrition-label-scanner-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-scanner);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: max(16px, env(safe-area-inset-top, 0px)) 16px max(16px, env(safe-area-inset-bottom, 0px));
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  box-sizing: border-box;
}
.nutrition-label-scanner-overlay .nutrition-label-scanner-sheet {
  margin: auto;
  flex-shrink: 0;
  width: 100%;
}
.nutrition-label-scanner-sheet {
  max-width: min(440px, 100vw - 24px);
  max-height: min(90vh, 720px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.nutrition-label-scan-frame {
  position: relative;
  margin: 0 0 14px;
  aspect-ratio: 3 / 4;
  max-height: 200px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--text) 8%, transparent);
  overflow: hidden;
}
.nutrition-label-scan-frame::before {
  content: "";
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    180deg,
    transparent 0,
    transparent 6px,
    color-mix(in srgb, var(--text) 4%, transparent) 6px,
    color-mix(in srgb, var(--text) 4%, transparent) 7px
  );
  opacity: 0.35;
  pointer-events: none;
  animation: nutrition-label-scan-sweep 2.4s ease-in-out infinite;
}
@keyframes nutrition-label-scan-sweep {
  0%,
  100% {
    transform: translateY(-8%);
    opacity: 0.2;
  }
  50% {
    transform: translateY(8%);
    opacity: 0.5;
  }
}
.nutrition-label-scan-frame-inner {
  position: absolute;
  inset: 14px;
  border: 2px solid color-mix(in srgb, var(--accent, #6b9) 70%, #fff);
  border-radius: 8px;
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, #000 12%, transparent),
    0 0 0 9999px color-mix(in srgb, #000 45%, transparent);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 10px;
}
.nutrition-label-scan-frame-inner::before,
.nutrition-label-scan-frame-inner::after {
  content: "";
  position: absolute;
  width: 22px;
  height: 22px;
  border: 3px solid color-mix(in srgb, var(--accent, #6b9) 85%, #fff);
}
.nutrition-label-scan-frame-inner::before {
  top: -2px;
  left: -2px;
  border-right: none;
  border-bottom: none;
  border-radius: 6px 0 0 0;
}
.nutrition-label-scan-frame-inner::after {
  top: -2px;
  right: -2px;
  border-left: none;
  border-bottom: none;
  border-radius: 0 6px 0 0;
}
.nutrition-label-scan-frame-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--text) 55%, transparent);
}
.nutrition-label-scanned-summary {
  font-size: 13px;
  font-weight: 500;
  margin: 0 0 12px;
  line-height: 1.45;
  color: var(--py-ink-muted, var(--text-muted, inherit));
}
.nutrition-label-scan-btn {
  flex: 1 1 auto;
  min-width: 140px;
}
.nutrition-label-scanner-intro {
  margin: 0 0 14px;
  line-height: 1.45;
}
.nutrition-label-scanner-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}
.nutrition-label-file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
.nutrition-label-scanner-error {
  color: color-mix(in srgb, #c44 88%, var(--text));
  font-size: 13px;
  margin: 0 0 12px;
  line-height: 1.4;
}
.nutrition-label-scanner-results {
  margin-top: 8px;
}
.nutrition-label-confidence {
  font-size: 13px;
  margin-bottom: 12px;
  line-height: 1.4;
}
.nutrition-label-macro-grid {
  margin-bottom: 14px;
}
.nutrition-label-portion-block {
  margin: 14px 0;
}
.nutrition-label-portion-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
}
.nutrition-label-portion-amount {
  width: 88px;
  min-width: 72px;
  flex: 0 0 auto;
}
.nutrition-label-portion-unit {
  flex: 1 1 120px;
  min-width: 100px;
  max-width: 200px;
}
.nutrition-label-scaled-preview {
  margin: 10px 0 0;
  font-weight: 500;
}
.nutrition-label-ocr-raw pre {
  font-size: 11px;
  white-space: pre-wrap;
  max-height: 120px;
  overflow: auto;
  margin: 8px 0 0;
  padding: 8px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--text) 6%, transparent);
}
```

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

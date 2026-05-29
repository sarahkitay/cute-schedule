/**
 * Parse USDA-style Nutrition Facts OCR text into per-serving macros.
 * Tuned for Vision / Tesseract output from packaged food labels.
 */

function parseNum(raw) {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** @typedef {{ protein: number, carbs: number, fat: number, calories: number, servingSize?: string, servingsPerContainer?: number }} LabelMacros */

/**
 * @param {string} text
 * @returns {{ macros: LabelMacros | null, confidence: 'high' | 'medium' | 'low', debug?: string[] }}
 */
export function parseNutritionLabelText(text) {
  const debug = [];
  if (!text || typeof text !== "string") {
    return { macros: null, confidence: "low", debug };
  }

  const raw = text.replace(/\u00a0/g, " ");
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

  const calories = extractCalories(flat, lines, debug);
  const protein = extractMacro(flat, lines, [
    /protein\s*[:\s]*(\d+(?:[.,]\d+)?)\s*g/i,
    /(\d+(?:[.,]\d+)?)\s*g\s*protein/i,
    /protein\s+(\d+(?:[.,]\d+)?)/i,
  ], "protein", debug);

  const fat = extractMacro(flat, lines, [
    /total\s*fat\s*[:\s]*(\d+(?:[.,]\d+)?)\s*g/i,
    /total\s*fat\s+(\d+(?:[.,]\d+)?)/i,
    /fat\s*[:\s]*(\d+(?:[.,]\d+)?)\s*g/i,
  ], "fat", debug);

  const carbs = extractMacro(flat, lines, [
    /total\s*carb(?:ohydrate)?s?\s*[:\s]*(\d+(?:[.,]\d+)?)\s*g/i,
    /total\s*carb(?:ohydrate)?s?\s+(\d+(?:[.,]\d+)?)/i,
    /carb(?:ohydrate)?s?\s*[:\s]*(\d+(?:[.,]\d+)?)\s*g/i,
  ], "carbs", debug);

  const found = [calories, protein, carbs, fat].filter((v) => v != null && v > 0).length;
  if (found < 2) {
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
  if (found >= 4) confidence = "high";
  else if (found === 2 && calories != null) confidence = "medium";

  return { macros, confidence, debug };
}

function extractCalories(flat, lines, debug) {
  const patterns = [
    /calories\s*[:\s]*(\d{2,4})\b/i,
    /(\d{2,4})\s*calories\b/i,
    /\bCalories\s+(\d{2,4})\b/,
    /energy\s*[:\s]*(\d{2,4})\s*kcal/i,
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
  for (let i = 0; i < lines.length; i++) {
    if (/^calories$/i.test(lines[i]) && lines[i + 1]) {
      const v = parseNum(lines[i + 1].replace(/[^\d.,]/g, ""));
      if (v != null && v >= 5) {
        debug.push(`calories (next line): ${v}`);
        return v;
      }
    }
    const inline = lines[i].match(/^calories\s+(\d{2,4})$/i);
    if (inline) {
      debug.push(`calories (line): ${inline[1]}`);
      return parseNum(inline[1]);
    }
  }
  return null;
}

function extractMacro(flat, lines, patterns, name, debug) {
  for (const re of patterns) {
    const m = flat.match(re);
    if (m) {
      const v = parseNum(m[1]);
      if (v != null && v >= 0 && v < 500) {
        debug.push(`${name}: ${v}`);
        return v;
      }
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (new RegExp(`^${name}$`, "i").test(line) || new RegExp(`total\\s*${name}`, "i").test(line)) {
      const next = lines[i + 1] || "";
      const gm = next.match(/(\d+(?:[.,]\d+)?)\s*g/i) || line.match(/(\d+(?:[.,]\d+)?)\s*g/i);
      if (gm) {
        const v = parseNum(gm[1]);
        if (v != null) {
          debug.push(`${name} (adjacent): ${v}`);
          return v;
        }
      }
    }
    const combined = line.match(
      name === "fat"
        ? /total\s*fat\s*(\d+(?:[.,]\d+)?)/i
        : name === "carbs"
          ? /total\s*carb(?:ohydrate)?s?\s*(\d+(?:[.,]\d+)?)/i
          : /protein\s*(\d+(?:[.,]\d+)?)/i
    );
    if (combined) {
      const v = parseNum(combined[1]);
      if (v != null) {
        debug.push(`${name} (combined): ${v}`);
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

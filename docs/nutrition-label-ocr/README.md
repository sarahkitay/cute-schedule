# Nutrition Label OCR — Porting Package

Self-contained extract of ProYou’s AI / OCR nutrition-label scanner so you can drop it into another Capacitor + React (or similar) repo.

**Full concatenated source:** [ALL_CODE.md](./ALL_CODE.md)  
**Individual files:** `js/`, `api/`, `ios/`, `css/`

---

## What it does

1. **iOS (preferred):** Live camera scanner with a Nutrition Facts guide frame, live Cal/Pro/Fat/Carb HUD (Vision OCR), then a high-quality capture pass with multi-crop / contrast OCR.
2. **iOS photo library / web:** Pick or capture a photo → OCR (Vision on iOS, Tesseract.js on web).
3. **Local parse:** Regex / layout-aware parser turns OCR text into calories, protein, fat, carbs (+ serving size).
4. **AI enhance (optional):** If local confidence is low, `POST /api/nutrition-label` sends OCR text and/or image to OpenAI (`gpt-4o-mini`) for a second opinion.
5. **UI:** Modal to edit macros, scale by portion (servings / cups / oz / grams), then `onApply` with scaled totals.

```
┌─────────────┐     ┌──────────────────┐     ┌────────────────────┐
│ Scan / Pick │ ──► │ Vision / Tess OCR│ ──► │ Local macro parse  │
└─────────────┘     └──────────────────┘     └─────────┬──────────┘
                                                       │ low confidence?
                                                       ▼
                                            ┌────────────────────┐
                                            │ /api/nutrition-label│
                                            │ (OpenAI vision/text)│
                                            └────────────────────┘
```

---

## File map (this package → drop into your repo)

| This package | Typical destination |
|--------------|---------------------|
| `js/nutritionLabelScanner.js` | `src/nutritionLabelScanner.js` |
| `js/nutritionLabelParser.js` | `src/nutritionLabelParser.js` |
| `js/nutritionLabelCoachApi.js` | `src/nutritionLabelCoachApi.js` |
| `js/NutritionLabelScanner.jsx` | `src/components/NutritionLabelScanner.jsx` |
| `js/nutritionLabelParser.test.mjs` | `src/nutritionLabelParser.test.mjs` |
| `api/nutrition-label.js` | `api/nutrition-label.js` (Vercel serverless) |
| `api/nutritionLabelRateLimit.js` | `api/lib/nutritionLabelRateLimit.js` |
| `ios/*.swift` | `ios/App/App/` (Capacitor iOS target) |
| `css/nutrition-label-scanner.css` | your stylesheet |

---

## Dependencies

### npm

```bash
npm install @capacitor/core tesseract.js
```

- **iOS native path:** Capacitor + custom plugin (no extra npm OCR SDK).
- **Web fallback:** `tesseract.js` (dynamic import in `nutritionLabelScanner.js`).

### Server (AI enhance)

- `OPENAI_API_KEY` env var
- Optional Redis / Upstash for rate limiting (`kv` in `nutritionLabelRateLimit.js`)
- CORS helper + safe error logger (see stubs below)

### iOS frameworks / permissions

Add to `Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>This app uses the camera to scan nutrition labels.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>This app can read nutrition label photos from your library.</string>
```

Link / use: **AVFoundation**, **Vision**, **UIKit**, **CoreImage**, **Capacitor**.

Register the plugin class name in Capacitor’s `packageClassList` (or your merge script):

```text
ProyouNutritionLabelPlugin
```

JS registration name must match Swift `jsName`:

```js
registerPlugin("ProyouNutritionLabel")
```

---

## Capacitor plugin API

| Method | Args | Returns |
|--------|------|---------|
| `isAvailable` | — | `{ available, visionOcr, liveScanner }` |
| `scanLabel` | — | `{ text, lines, imageBase64?, macros? }` |
| `pickLabelPhoto` | — | same |
| `recognizeImage` | `{ base64 }` | same |

`macros` shape when native parse finds ≥2 values:

```json
{ "calories": 230, "protein": 3, "fat": 8, "carbs": 37 }
```

Cancel rejects with code `CANCELLED`.

---

## Minimal React usage

```jsx
import { useState } from "react";
import { NutritionLabelScanner } from "./components/NutritionLabelScanner";

function MealLogger() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Scan nutrition label
      </button>
      <NutritionLabelScanner
        open={open}
        onClose={() => setOpen(false)}
        onApply={(meal) => {
          // meal: { food, protein, carbs, fat, calories, perServing, portion }
          console.log(meal);
          setOpen(false);
        }}
      />
    </>
  );
}
```

Headless (no modal) — open camera and parse yourself:

```js
import { launchNutritionLabelScan } from "./nutritionLabelScanner";
import { parseNutritionLabelText, shouldEnhanceLabelParse } from "./nutritionLabelParser";
import { parseNutritionLabelWithCoachApi } from "./nutritionLabelCoachApi";

const ocr = await launchNutritionLabelScan();
let parsed = parseNutritionLabelText(ocr.text);
if (shouldEnhanceLabelParse(parsed, { hasImage: Boolean(ocr.imageBase64) })) {
  const api = await parseNutritionLabelWithCoachApi({
    text: ocr.text,
    imageBase64: ocr.imageBase64,
  });
  parsed = { macros: { ...parsed.macros, ...api.macros }, confidence: api.confidence };
}
```

---

## Adaptations you’ll need in a new repo

### 1. `apiUrl` helper

`nutritionLabelCoachApi.js` imports `./apiBase.js`. Either copy a thin helper:

```js
export function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const origin = (import.meta.env.VITE_APP_ORIGIN || "").replace(/\/+$/, "");
  return origin ? `${origin}${p}` : p;
}
```

…or change the import to your own base URL builder. On Capacitor, relative `/api/*` hits `localhost` — set `VITE_APP_ORIGIN` to your deployed API host before `vite build`.

### 2. UI primitives in `NutritionLabelScanner.jsx`

The component uses ProYou classes / icons:

- `CloseIcon` from `../Icons` → swap for your close button
- Classes: `modal-overlay`, `btn`, `btn-primary`, `btn-icon`, `input`, `label`, `quick-row`, `surface-glass`, `health-*`

Either keep those class names and paste `css/nutrition-label-scanner.css`, or restyle the JSX.

### 3. API shared libs

`api/nutrition-label.js` imports:

| Import | What to do |
|--------|------------|
| `./lib/cors.js` → `applyApiCors` | Copy your CORS middleware, or no-op headers |
| `./lib/safeJsonError.js` → `clientSafeDetail`, `logServerError` | Log + return generic message |
| `./lib/nutritionLabelRateLimit.js` | Included; depends on Redis `kv` + `getCoachRateLimitClientId` |

**Rate-limit stub** (no Redis — allow all):

```js
export async function assertNutritionLabelRateLimit() {
  return { ok: true };
}
export function validateNutritionLabelPayload(body) {
  const text = typeof body?.text === "string" ? body.text : "";
  const image = typeof body?.imageBase64 === "string" ? body.imageBase64 : "";
  if (text.length > 12_000) return "OCR text is too long.";
  if (image.length > 6_000_000) return "Image is too large.";
  return null;
}
```

**CORS stub:**

```js
export function applyApiCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
}
```

### 4. Xcode

1. Add all five Swift files to the App target.
2. Ensure `ProyouNutritionLabelPlugin` is in `packageClassList` after `cap sync`.
3. Rebuild on a **physical iPhone** (camera / live OCR won’t fully work in Simulator).

### 5. Optional: skip AI enhance

Local parse alone is often enough for clean FDA panels. To disable the OpenAI call, either:

- Don’t deploy `/api/nutrition-label`, or
- Short-circuit `shouldEnhanceLabelParse` to always return `false`, or
- Catch errors in `applyOcrToForm` (already keeps local macros if present).

---

## Tests

```bash
node --test docs/nutrition-label-ocr/js/nutritionLabelParser.test.mjs
# or after copying into src/:
npm run test:nutrition-label
```

---

## Native Swift overview

| File | Role |
|------|------|
| `ProyouNutritionLabelPlugin.swift` | Capacitor bridge: scan / pick / recognize |
| `NutritionLabelScannerViewController.swift` | Full-screen AVCapture live UI + capture |
| `NutritionLabelOcr.swift` | Vision OCR, line assembly, %DV column filter |
| `NutritionLabelImagePipeline.swift` | Contrast / sharpen / rectangle crop candidates |
| `NutritionLabelMacroParser.swift` | Native regex macro extract (mirrors JS parser) |

Live preview uses **fast** OCR inside the guide ROI; capture uses **accurate** multi-pass `recognizeStrong`.

---

## Payload contract (plugin → JS)

```ts
type OcrResult = {
  text: string;
  lines: string[];
  imageBase64?: string; // data:image/jpeg;base64,...
  macros?: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  };
};
```

AI API response:

```ts
type ApiResult = {
  macros: {
    protein: number;
    carbs: number;
    fat: number;
    calories: number;
    servingSize?: string;
  };
  foodName: string | null;
  confidence: "high" | "medium" | "low";
};
```

---

## License / notes

Extracted from the ProYou (`cute-schedule`) app for reuse. Replace camera permission strings and product name (`PROYOU`) when you port. OpenAI usage bills against your key — keep rate limits in production.

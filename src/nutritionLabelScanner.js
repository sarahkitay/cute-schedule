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

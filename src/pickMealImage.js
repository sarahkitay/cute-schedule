import { Capacitor, registerPlugin } from "@capacitor/core";

const ProyouNutritionLabel = registerPlugin("ProyouNutritionLabel");

function isNativeMealPhotoAvailable() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

function parseImagePayload(imageBase64) {
  const raw = String(imageBase64 || "").trim();
  if (!raw || raw.length < 32) {
    const err = new Error("No photo captured.");
    err.code = "NO_IMAGE";
    throw err;
  }
  const mimeMatch = raw.startsWith("data:") ? raw.match(/^data:([^;]+);/) : null;
  const mimeType = mimeMatch?.[1] || "image/jpeg";
  return { base64: raw, mimeType };
}

function pickWebPhoto(preferCamera) {
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
          const base64 = await blobToBase64(file);
          resolve({
            base64,
            mimeType: file.type || "image/jpeg",
          });
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

/**
 * Camera or library photo for plated-meal estimates. Does not run label OCR.
 * @param {{ camera?: boolean }} [opts]
 * @returns {Promise<{ base64: string, mimeType: string }>}
 */
export async function pickMealPhoto(opts = {}) {
  const camera = Boolean(opts.camera);
  if (isNativeMealPhotoAvailable()) {
    try {
      const result = camera
        ? await ProyouNutritionLabel.takePhoto()
        : await ProyouNutritionLabel.pickPhoto();
      return parseImagePayload(result?.imageBase64);
    } catch (err) {
      if (err?.code === "CANCELLED" || String(err?.message || "").toLowerCase().includes("cancel")) {
        throw err;
      }
      // Older builds without takePhoto/pickPhoto — fall back to web input.
      if (
        String(err?.message || "").includes("not implemented") ||
        String(err?.code || "") === "UNIMPLEMENTED"
      ) {
        return pickWebPhoto(camera);
      }
      throw err;
    }
  }
  return pickWebPhoto(camera);
}

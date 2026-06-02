import { Capacitor, registerPlugin } from "@capacitor/core";

const ProyouMusicPicker = registerPlugin("ProyouMusicPicker");

function isPluginNotRegisteredError(err) {
  const msg = String(err?.message ?? err ?? "");
  return /not implemented/i.test(msg);
}

/** True on a real iPhone/iPad build (not web or simulator). */
export function isAppleMusicLibraryPickerAvailable() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

/**
 * Opens the system Apple Music / library picker and returns a File for alarm storage.
 * @returns {Promise<{ file: File, title: string }>}
 */
export async function pickSongFromAppleMusicLibrary() {
  if (!isAppleMusicLibraryPickerAvailable()) {
    const err = new Error("Apple Music library picker is only available in the PROYOU iOS app.");
    err.code = "APPLE_MUSIC_IOS_ONLY";
    throw err;
  }
  let avail;
  try {
    avail = await ProyouMusicPicker.isAvailable();
  } catch (err) {
    if (isPluginNotRegisteredError(err)) {
      const e = new Error(
        "Apple Music picker is not registered in this build. From the project root run npm run cap:sync:ios, then in Xcode use Product → Clean Build Folder and rebuild on a physical iPhone."
      );
      e.code = "PLUGIN_NOT_REGISTERED";
      throw e;
    }
    throw err;
  }
  if (!avail?.available) {
    const err = new Error("Music library picker is not available on this device (try a physical iPhone).");
    err.code = "APPLE_MUSIC_UNAVAILABLE";
    throw err;
  }
  let result;
  try {
    result = await ProyouMusicPicker.pickSong();
  } catch (err) {
    if (isPluginNotRegisteredError(err)) {
      const e = new Error(
        "Apple Music picker is not registered in this build. From the project root run npm run cap:sync:ios, then in Xcode use Product → Clean Build Folder and rebuild on a physical iPhone."
      );
      e.code = "PLUGIN_NOT_REGISTERED";
      throw e;
    }
    throw err;
  }
  const webPath = Capacitor.convertFileSrc(result.path);
  const res = await fetch(webPath);
  if (!res.ok) throw new Error("Could not read the selected song.");
  const blob = await res.blob();
  const ext = result.path.split(".").pop() || "m4a";
  const safeTitle = (result.title || "Song").replace(/[/\\?%*:|"<>]/g, "-").slice(0, 80);
  const file = new File([blob], `${safeTitle}.${ext}`, {
    type: result.mimeType || blob.type || "audio/mp4",
  });
  return {
    file,
    title: result.title || safeTitle,
    /** Native filesystem path (use for AlarmKit without re-encoding). */
    nativePath: result.path,
  };
}

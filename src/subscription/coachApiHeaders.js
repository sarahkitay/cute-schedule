import { getDeviceId } from "../firebase.js";
import { getFirebaseIdToken } from "../firebaseIdToken.js";

export async function getCoachRequestHeaders() {
  /** @type {Record<string, string>} */
  const headers = { "Content-Type": "application/json" };
  try {
    const token = await getFirebaseIdToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* ignore */
  }
  try {
    const deviceId = getDeviceId();
    if (deviceId) headers["X-ProYou-Device-Id"] = deviceId;
  } catch {
    /* ignore */
  }
  return headers;
}

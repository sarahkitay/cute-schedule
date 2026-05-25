import { initFirebase } from "./firebase.js";

/** @returns {Promise<string | null>} */
export async function getFirebaseIdToken() {
  const { auth } = initFirebase();
  if (!auth?.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken();
  } catch {
    return null;
  }
}

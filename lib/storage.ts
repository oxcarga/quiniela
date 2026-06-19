import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

// Uploads an ad image to `ads/` in Firebase Storage and returns its public
// download URL. Only admins may write here (see storage.rules). The filename is
// prefixed with a timestamp so re-uploads don't collide or get cache-stale.
export async function uploadAdImage(file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `ads/${Date.now()}-${safeName}`;
  const snap = await uploadBytes(ref(storage, path), file, {
    contentType: file.type,
  });
  return getDownloadURL(snap.ref);
}

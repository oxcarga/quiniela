"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { uploadAdImage } from "@/lib/storage";

// Uploads a selected image to Firebase Storage (ads/) and hands the resulting
// download URL back to the parent. Admin-only access is enforced by storage.rules.
export default function ImageUpload({
  label = "Subir imagen",
  onUploaded,
}: {
  label?: string;
  onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const url = await uploadAdImage(file);
      onUploaded(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir la imagen.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
          disabled={uploading}
        />
        <Upload className="h-4 w-4" />
        {uploading ? "Subiendo…" : label}
      </label>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

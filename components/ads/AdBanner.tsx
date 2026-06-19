"use client";

import { useEffect, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import { useAdBanner } from "@/hooks/useAdBanner";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const DISMISS_KEY = "adBanner.dismissed";

// Only admins can write the banner HTML (Firestore rules), so the content is
// trusted; sanitizing is defense-in-depth and keeps the markup well-formed.
// `target` is kept so promo links can open in a new tab; tel:/mailto:/https:
// are already permitted by DOMPurify's default URI allow-list.
function sanitize(html: string): string {
  return DOMPurify.sanitize(html, { ADD_ATTR: ["target"] });
}

export default function AdBanner() {
  const { data: banner } = useAdBanner();
  const isAdmin = useIsAdmin();
  const [open, setOpen] = useState(false);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  // Read the remembered dismissal after mount to avoid a hydration mismatch.
  useEffect(() => {
    setDismissedVersion(localStorage.getItem(DISMISS_KEY));
  }, []);

  // Close the modal on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!banner || !banner.active || !banner.imageUrl) return null;
  // In preview mode the banner is visible to admins only (and stays hidden while
  // the admin claim is still resolving, so non-admins never get a flash of it).
  if (banner.previewMode && isAdmin !== true) return null;
  if (dismissedVersion === banner.version) return null;

  function dismiss() {
    if (!banner) return;
    localStorage.setItem(DISMISS_KEY, banner.version);
    setDismissedVersion(banner.version);
  }

  return (
    <>
      <div className="flex justify-center mb-6">
        <div
          onClick={() => setOpen(true)}
          className="relative cursor-pointer"
          aria-label={banner.alt || "Ver más información"}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner.imageUrl} alt={banner.alt} className="w-full" />
          {banner.previewMode && (
            <span className="absolute left-0 -top-5 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black shadow">
              Vista previa (SOLO ADMINS)
            </span>
          )}
          <button
            onClick={dismiss}
            aria-label="Cerrar anuncio"
            className="absolute right-2 top-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full font-semibold bg-sky-900 text-sm leading-none text-white transition-colors hover:bg-white/40"
          >
            ×
          </button>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-4 flex justify-end">
              <button
                onClick={() => setOpen(false)}
                className="cursor-pointer text-xl leading-none text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-200"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <div
              className="ad-modal-content"
              dangerouslySetInnerHTML={{ __html: sanitize(banner.modalHtml) }}
            />
          </div>
        </div>
      )}
    </>
  );
}

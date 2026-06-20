"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import { useAdBanner } from "@/hooks/useAdBanner";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { logAdEvent, type AdEvent } from "@/lib/adStats";

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
  // Read the remembered dismissal synchronously so a dismissed banner never
  // flashes on (re)mount. SSR-safe: the banner's render is gated on `banner`
  // (a client-only React Query fetch) which is undefined during hydration, so
  // server and first client render both produce nothing.
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem(DISMISS_KEY)
  );

  // Per-session interaction flags. Refs so updating them never re-renders.
  const impressionFired = useRef(false);
  const openedModal = useRef(false);
  const clickedInModal = useRef(false);

  const visible =
    !!banner &&
    banner.active &&
    !!banner.imageUrl &&
    // In preview mode the banner is visible to admins only (and stays hidden
    // while the admin claim is still resolving, so non-admins never get a flash).
    !(banner.previewMode && isAdmin !== true) &&
    dismissedVersion !== banner.version;

  // Never record stats for admins or while previewing — it would inflate the
  // numbers the admin is trying to read.
  const tracking = visible && !banner?.previewMode && isAdmin !== true;

  // Count one impression per mount, once the banner is actually shown.
  useEffect(() => {
    if (tracking && banner && !impressionFired.current) {
      impressionFired.current = true;
      logAdEvent("impression", banner.version);
    }
  }, [tracking, banner]);

  const closeModal = useCallback(() => {
    if (tracking && banner && !clickedInModal.current) {
      logAdEvent("modalCloseNoClick", banner.version);
    }
    setOpen(false);
  }, [tracking, banner]);

  // Close the modal on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeModal();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeModal]);

  if (!banner || !visible) return null;

  function track(event: AdEvent) {
    if (!tracking || !banner) return;
    logAdEvent(event, banner.version);
  }

  function openModal() {
    openedModal.current = true;
    clickedInModal.current = false;
    track("modalOpen");
    setOpen(true);
  }

  function dismiss() {
    if (!banner) return;
    track(openedModal.current ? "bannerCloseAfterModal" : "bannerClose");
    localStorage.setItem(DISMISS_KEY, banner.version);
    setDismissedVersion(banner.version);
  }

  // The modal HTML is admin-authored and injected via dangerouslySetInnerHTML,
  // so its links aren't React elements — classify clicks via event delegation.
  function handleModalClick(e: React.MouseEvent<HTMLDivElement>) {
    const anchor = (e.target as HTMLElement).closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href") ?? "";
    const event: AdEvent = /wa\.me|whatsapp/i.test(href)
      ? "clickWhatsapp"
      : /instagram\.com/i.test(href)
        ? "clickInstagram"
        : /^tel:/i.test(href)
          ? "clickPhone"
          : "clickOther";
    clickedInModal.current = true;
    track(event);
  }

  return (
    <>
      <div className="flex justify-center mb-6">
        <div
          onClick={openModal}
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
          onClick={closeModal}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-4 flex justify-end">
              <button
                onClick={closeModal}
                className="cursor-pointer text-xl leading-none text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-200"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <div
              className="ad-modal-content"
              onClick={handleModalClick}
              dangerouslySetInnerHTML={{ __html: sanitize(banner.modalHtml) }}
            />
          </div>
        </div>
      )}
    </>
  );
}

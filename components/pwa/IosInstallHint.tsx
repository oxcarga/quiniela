"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

const DISMISS_KEY = "ios-install-hint-dismissed";

export default function IosInstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return;

    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    // On iOS, only Safari's WebKit can "Add to Home Screen" — skip Chrome/Firefox/Edge.
    const isSafari = !/CriOS|FxiOS|EdgiOS/.test(ua);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari exposes installed state here:
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;

    if (isIOS && isSafari && !isStandalone) setVisible(true);
  }, []);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-16 z-50 px-3 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-2xl items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
        <p className="flex-1 text-sm text-zinc-700 dark:text-zinc-200">
          Instala la app: toca{" "}
          <Share size={16} className="inline -translate-y-px text-blue-600" />{" "}
          y luego{" "}
          <span className="font-semibold">&ldquo;Añadir a inicio&rdquo;</span>.
        </p>
        <button
          onClick={dismiss}
          aria-label="Cerrar"
          className="shrink-0 rounded-md p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

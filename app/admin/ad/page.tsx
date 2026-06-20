"use client";

import { useEffect, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import { FileCode2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdBanner } from "@/hooks/useAdBanner";
import { setAdBanner } from "@/lib/firestore";
import ImageUpload from "@/components/ads/ImageUpload";

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, { ADD_ATTR: ["target"] });
}

// Starter content for a new banner. It lives here in source (not just at runtime)
// so Tailwind compiles every class it uses — utilities only referenced inside the
// Firestore string would otherwise never make it into the generated CSS.
const MODAL_TEMPLATE = `<div class="flex flex-col items-center text-center">
  <div class="mb-4 flex h-32 w-32 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-5xl shadow-lg">
    📺
  </div>

  <h2 class="text-xl font-bold text-zinc-900 dark:text-zinc-50">OneTV</h2>
  <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Patrocinador oficial de la quiniela</p>

  <div class="my-5 w-full rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 p-4 dark:from-amber-950/40 dark:to-orange-950/30">
    <h5 class="text-md font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">🏆 Premios</h5>
    <p class="mt-1 text-sm text-amber-900 dark:text-amber-100">
      Los <strong>3 primeros lugares</strong> al finalizar el torneo ganan una
      <strong>cuenta IPTV gratis</strong>.
    </p>

    <ul class="mt-3 flex flex-col gap-1.5 text-sm text-amber-900 dark:text-amber-100">
      <li class="flex items-center justify-center gap-2">
        <span class="text-base">🥇</span>
        <span><strong>3 meses</strong> gratis</span>
      </li>
      <li class="flex items-center justify-center gap-2">
        <span class="text-base">🥈</span>
        <span><strong>2 meses</strong> gratis</span>
      </li>
      <li class="flex items-center justify-center gap-2">
        <span class="text-base">🥉</span>
        <span><strong>1 mes</strong> gratis</span>
      </li>
    </ul>
  </div>

  <p class="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
    Miles de canales, deportes y películas en HD. Escríbenos para más información.
  </p>

  <div class="mt-5 flex gap-0">
    <a href="https://wa.me/50662622918" target="_blank" rel="noopener noreferrer" class="flex items-center justify-center gap-2 rounded-l-lg border border-zinc-300 bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">
      <svg viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4 text-green-600" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
      WhatsApp
    </a>
    <a href="https://www.instagram.com/onetvpluslatino" target="_blank" rel="noopener noreferrer" class="flex items-center justify-center gap-2 rounded-none border-y border-zinc-300 bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">
      <svg viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4 text-purple-600" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
      Instagram
    </a>
    <a href="tel:+50662622918" class="flex items-center justify-center gap-2 rounded-r-lg border border-zinc-300 bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">
      📞 +506 6262 2918
    </a>
  </div>
</div>`;

export default function AdEditorPage() {
  const { data: banner, isLoading } = useAdBanner();
  const queryClient = useQueryClient();

  const [imageUrl, setImageUrl]   = useState("");
  const [alt, setAlt]             = useState("");
  const [modalHtml, setModalHtml] = useState(MODAL_TEMPLATE);
  const [active, setActive]       = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [modalImgUrl, setModalImgUrl] = useState("");
  const [copied, setCopied]       = useState(false);

  // Prefill once the current banner loads.
  useEffect(() => {
    if (!banner) return;
    setImageUrl(banner.imageUrl ?? "");
    setAlt(banner.alt ?? "");
    setModalHtml(banner.modalHtml || MODAL_TEMPLATE);
    setActive(banner.active ?? false);
    setPreviewMode(banner.previewMode ?? false);
  }, [banner]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      await setAdBanner({ active, previewMode, imageUrl: imageUrl.trim(), alt: alt.trim(), modalHtml });
      queryClient.invalidateQueries({ queryKey: ["adBanner"] });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el anuncio.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Anuncio (banner)</h1>

      {saved && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          Anuncio guardado correctamente.
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-zinc-500">Cargando…</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium">
              <input
                type="checkbox"
                className="w-4 h-4 accent-primary cursor-pointer"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Mostrar el banner en la página principal
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium">
              <input
                type="checkbox"
                className="w-4 h-4 accent-primary cursor-pointer"
                checked={previewMode}
                onChange={(e) => setPreviewMode(e.target.checked)}
              />
              Modo vista previa <span className="font-normal text-zinc-500">(solo administradores lo ven)</span>
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Imagen del banner</label>
            <ImageUpload label="Subir imagen del banner" onUploaded={setImageUrl} />
            <Input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…/banner.png"
            />
            <p className="text-xs text-zinc-500">
              Sube una imagen (se guarda en Firebase Storage) o pega una URL.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Texto alternativo (accesibilidad)</label>
            <Input
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Ej. Servicio IPTV — premios para el top 3"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium">Contenido del modal (HTML)</label>
              <button
                type="button"
                onClick={() => setModalHtml(MODAL_TEMPLATE)}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-600 dark:text-zinc-300 dark:hover:border-zinc-400 dark:hover:text-zinc-100"
              >
                <FileCode2 className="h-3 w-3" />
                Cargar plantilla
              </button>
            </div>
            <textarea
              value={modalHtml}
              onChange={(e) => setModalHtml(e.target.value)}
              rows={10}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="<h2>…</h2><p>…</p><a href='https://…' target='_blank'>…</a>"
            />
            <p className="text-xs text-zinc-500">
              El HTML se sanitiza antes de mostrarse. Los enlaces (<code>https:</code>,{" "}
              <code>tel:</code>, <code>mailto:</code>) y <code>target=&quot;_blank&quot;</code> se conservan.
            </p>

            <div className="mt-2 flex flex-col gap-1.5 rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                ¿Necesitas una imagen dentro del modal? Súbela y copia su URL en tu HTML.
              </p>
              <ImageUpload
                label="Subir imagen del modal"
                onUploaded={(url) => {
                  setModalImgUrl(url);
                  setCopied(false);
                }}
              />
              {modalImgUrl && (
                <div className="flex items-center gap-2">
                  <Input value={modalImgUrl} readOnly className="font-mono text-xs" />
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(modalImgUrl);
                      setCopied(true);
                    }}
                    className="shrink-0 rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium transition-colors hover:border-zinc-400 dark:border-zinc-600 dark:hover:border-zinc-400"
                  >
                    {copied ? "¡Copiado!" : "Copiar"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Guardando…" : "Guardar anuncio"}
          </Button>
        </form>
      )}

      {/* Live preview */}
      {!isLoading && <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-zinc-500">Vista previa</h2>

        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={alt} className="w-full rounded-xl" />
        ) : (
          <p className="text-sm text-zinc-400">Agrega una URL de imagen para ver el banner.</p>
        )}

        {modalHtml && (
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
            <p className="mb-2 text-xs font-medium text-zinc-400">Modal:</p>
            <div
              className="ad-modal-content"
              dangerouslySetInnerHTML={{ __html: sanitize(modalHtml) }}
            />
          </div>
        )}
      </div>}
    </div>
  );
}

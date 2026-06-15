import { getFlagUrl } from "@/lib/flags";

interface FlagProps {
  emoji: string;
  size?: number[];
  className?: string;
}

export function Flag({ emoji, size = [32, 24], className }: FlagProps) {
  const [
    url,
    urlx2,
    urlx3,
    urlpng,
    urlpngx2,
    urlpngx3
  ] = getFlagUrl(emoji, size);
  if (!url || !urlpng) return null;
  return (
    <picture>
      <source
        type="image/webp"
        srcSet={`${url},
          ${urlx2} 2x,
          ${urlx3} 3x`} />
      <source
        type="image/png"
        srcSet={`${urlpng},
          ${urlpngx2} 2x,
          ${urlpngx3} 3x`} />
      <img
        className={className}
        src={urlpng}
        width={size[0]}
        height={size[1]}
        alt={emoji} />
    </picture>
  );
}

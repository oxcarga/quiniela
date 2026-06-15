import { getFlagUrl } from "@/lib/flags";

interface FlagProps {
  emoji: string;
  size?: number;
  className?: string;
}

export function Flag({ emoji, size = 40, className }: FlagProps) {
  const url = getFlagUrl(emoji, size);
  if (!url) return null;
  return (
    <img
      src={url}
      alt={emoji}
      width={size}
      className={className}
      style={{ display: "inline-block" }}
    />
  );
}

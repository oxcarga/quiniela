const RESULT_DOT: Record<string, { className: string; label: string }> = {
  W: { className: "bg-green-500", label: "Victoria" },
  D: { className: "bg-zinc-400", label: "Empate" },
  L: { className: "bg-red-500", label: "Derrota" },
};

const EMPTY_DOT = {
  className: "bg-transparent border border-zinc-300 dark:border-zinc-700",
  label: "Sin dato",
};

interface Props {
  results?: string[];
}

export default function FormDots({ results }: Props) {
  const slots = Array.from({ length: 5 }, (_, i) => {
    const result = results?.[i];
    return (result && RESULT_DOT[result]) || EMPTY_DOT;
  });

  return (
    <div className="flex items-center gap-1">
      {slots.map((dot, i) => (
        <span
          key={i}
          title={dot.label}
          aria-label={dot.label}
          className={`h-2 w-2 rounded-full ${dot.className}`}
        />
      ))}
    </div>
  );
}

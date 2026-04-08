export function AdvisoryBadge({
  advisory,
  className = "",
}: {
  advisory: boolean | null | undefined;
  className?: string;
}) {
  if (advisory !== true) {
    return null;
  }

  return (
    <span
      className={[
        "inline-flex items-center rounded-md border border-amber-200/30 bg-amber-300/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-100",
        className,
      ].join(" ")}
    >
      E
    </span>
  );
}

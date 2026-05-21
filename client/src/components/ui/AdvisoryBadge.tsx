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
        "inline-flex h-[13px] w-[13px] items-center justify-center rounded-[3px] bg-[#a5a5a5] text-[9px] font-bold text-black",
        className,
      ].join(" ")}
    >
      E
    </span>
  );
}

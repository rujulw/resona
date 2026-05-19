import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type ContextMenuProps = {
  x: number;
  y: number;
  onClose: () => void;
  items: { label: string; onClick: () => void }[];
};

export function ContextMenu({ x, y, onClose, items }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // Clamp so menu doesn't overflow viewport
  const left = Math.min(x, window.innerWidth - 168);
  const top = Math.min(y, window.innerHeight - items.length * 44 - 8);

  return createPortal(
    <div
      ref={ref}
      style={{ position: "fixed", top, left }}
      className="z-[9999] min-w-[160px] overflow-hidden rounded-sm border border-white/10 bg-[#1c1c1c] py-1 shadow-2xl"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className="flex w-full items-center px-4 py-2.5 text-left text-sm text-[#d4d4d4] hover:bg-white/[0.07] hover:text-white"
          onClick={() => {
            item.onClick();
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}

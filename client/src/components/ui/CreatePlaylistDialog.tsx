import { ImagePlus } from "lucide-react";

import { pickPlaylistArtwork } from "../../desktop";

export function CreatePlaylistDialog({
  isOpen,
  isSubmitting,
  dialogTitle,
  dialogDescription,
  submitLabel,
  nameDraft,
  descriptionDraft,
  selectedArtworkPath,
  onClose,
  onNameDraftChange,
  onDescriptionDraftChange,
  onSelectedArtworkPathChange,
  onSubmit,
}: {
  isOpen: boolean;
  isSubmitting?: boolean;
  dialogTitle?: string;
  dialogDescription?: string;
  submitLabel?: string;
  nameDraft: string;
  descriptionDraft?: string;
  selectedArtworkPath: string | null;
  onClose: () => void;
  onNameDraftChange: (value: string) => void;
  onDescriptionDraftChange?: (value: string) => void;
  onSelectedArtworkPathChange: (value: string | null) => void;
  onSubmit: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 px-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={dialogTitle ?? "Create playlist"}
        className="grid w-full max-w-lg gap-5 rounded-3xl border border-white/8 bg-[#181818] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
      >
        <div className="grid gap-2">
          <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">playlist</p>
          <h2 className="m-0 text-2xl font-medium tracking-[-0.04em] text-[#f2f2f2]">
            {(dialogTitle ?? "Create playlist").toLowerCase()}
          </h2>
          <p className="m-0 text-sm text-[#8f8f8f]">
            {dialogDescription ?? "Start with a name and an optional cover."}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-[96px_minmax(0,1fr)] sm:items-start">
          <div className="grid gap-2">
            <div className="grid h-24 w-24 place-items-center rounded-sm border border-white/8 bg-white/[0.04] text-[#8f8f8f]">
              <ImagePlus className="h-7 w-7" strokeWidth={1.75} />
            </div>
            <button
              type="button"
              onClick={() => {
                void pickPlaylistArtwork(selectedArtworkPath).then((value) => {
                  if (value) {
                    onSelectedArtworkPathChange(value);
                  }
                });
              }}
              className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-[#d4d4d4] transition-colors hover:border-white/12 hover:bg-white/[0.05] hover:text-[#f2f2f2]"
            >
              Choose cover
            </button>
          </div>

          <div className="grid gap-4">
            <label className="grid gap-2 text-sm text-[#d7d7d7]">
              <span className="text-[11px] tracking-[0.08em] text-[#8f8f8f]">
                playlist name
              </span>
              <input
                value={nameDraft}
                autoFocus
                onChange={(event) => onNameDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    onSubmit();
                  }
                }}
                placeholder="Late night mix"
                className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-[#f2f2f2] outline-none placeholder:text-[#6f6f6f]"
              />
            </label>

            {onDescriptionDraftChange ? (
              <label className="grid gap-2 text-sm text-[#d7d7d7]">
                <span className="text-[11px] tracking-[0.08em] text-[#8f8f8f]">
                  description
                </span>
                <textarea
                  value={descriptionDraft ?? ""}
                  onChange={(event) => onDescriptionDraftChange(event.target.value)}
                  rows={3}
                  placeholder="Late drive through the city"
                  className="w-full resize-none rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-[#f2f2f2] outline-none placeholder:text-[#6f6f6f]"
                />
              </label>
            ) : null}

            <div className="grid gap-1">
              <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">cover</p>
              <p className="m-0 truncate text-sm text-[#d4d4d4]">
                {selectedArtworkPath ?? "No custom cover selected."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-2.5 text-sm text-[#d4d4d4] transition-colors hover:border-white/12 hover:bg-white/[0.05] hover:text-[#f2f2f2]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting || !nameDraft.trim()}
            onClick={onSubmit}
            className="rounded-xl border border-white/10 bg-[#272727] px-4 py-2.5 text-sm text-[#f2f2f2] transition-colors hover:border-white/14 hover:bg-[#303030] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitLabel ?? "Create playlist"}
          </button>
        </div>
      </div>
    </div>
  );
}

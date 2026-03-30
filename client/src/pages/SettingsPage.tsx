import type { LibraryRow } from "../desktop";
import type { ScanState } from "../types/app";

export function SettingsPage({
  libraryRows,
  libraryPath,
  platformLabel,
  appVersion,
  scanState,
  onLibraryPathChange,
  onScan,
}: {
  libraryRows: LibraryRow[];
  libraryPath: string;
  platformLabel: string;
  appVersion: string;
  scanState: ScanState;
  onLibraryPathChange: (value: string) => void;
  onScan: () => void;
}) {
  return (
    <div className="grid gap-6 px-6 py-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">settings</p>
          <h2 className="mt-2 text-3xl font-medium tracking-[-0.04em] text-[#f2f2f2]">
            library roots and desktop wiring
          </h2>
        </div>
        <p className="m-0 text-sm text-[#8f8f8f]">
          {platformLabel} • v{appVersion}
        </p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
        <div className="rounded-3xl border border-white/6 bg-[#1b1b1b] p-5">
          <div className="grid gap-4">
            <div>
              <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">import</p>
              <h3 className="text-lg font-medium text-[#f2f2f2]">scan local library</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                aria-label="Temporary local library path"
                placeholder="/Users/you/Music"
                className="min-w-65 flex-1 rounded-2xl border border-white/8 bg-white/3 px-4 py-3 text-sm text-[#e5e5e5] outline-none placeholder:text-[#8f8f8f]"
                type="text"
                value={libraryPath}
                onChange={(event) => {
                  onLibraryPathChange(event.target.value);
                }}
              />
              <button
                className="rounded-2xl border border-white/8 bg-[#272727] px-4 py-3 text-sm text-[#f2f2f2] transition-colors hover:border-white/12 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={onScan}
                disabled={scanState.status === "running"}
              >
                {scanState.status === "running" ? "scanning..." : "scan library"}
              </button>
            </div>
            {scanState.message ? (
              <p className="m-0 text-sm text-[#8f8f8f]">{scanState.message}</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-white/6 bg-[#1b1b1b] p-5">
          <div className="grid gap-3">
            <div>
              <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">sources</p>
              <h3 className="text-lg font-medium text-[#f2f2f2]">indexed systems</h3>
            </div>
            <div className="grid gap-3">
              {libraryRows.map((row) => (
                <div
                  key={row.title}
                  className="rounded-2xl border border-white/6 bg-white/3 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-[#f2f2f2]">{row.title}</span>
                    <span className="text-[11px] uppercase tracking-[0.14em] text-[#8f8f8f]">
                      {row.state}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#8f8f8f]">{row.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

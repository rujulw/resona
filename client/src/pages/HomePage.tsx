import type { LibraryRow } from "../desktop";

export function HomePage({
  libraryRows,
  trackCount,
  appVersion,
}: {
  libraryRows: LibraryRow[];
  trackCount: number;
  appVersion: string;
}) {
  return (
    <div className="grid gap-6 px-6 py-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">home</p>
          <h2 className="mt-2 text-3xl font-medium tracking-[-0.04em] text-[#f2f2f2]">
            desktop music utility
          </h2>
        </div>
        <p className="m-0 text-sm text-[#8f8f8f]">v{appVersion}</p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <div className="rounded-3xl border border-white/6 bg-[#1b1b1b] p-5">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["tracks", String(trackCount)],
              ["sources", String(libraryRows.length)],
              ["transport", "idle"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-4"
              >
                <span className="text-[11px] uppercase tracking-[0.16em] text-[#8f8f8f]">
                  {label}
                </span>
                <strong className="mt-3 block text-3xl font-medium tracking-[-0.04em] text-[#f2f2f2]">
                  {value}
                </strong>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/6 bg-[#1b1b1b] p-5">
          <div className="grid gap-3">
            <div>
              <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">status</p>
              <h3 className="text-lg font-medium text-[#f2f2f2]">system surfaces</h3>
            </div>
            <div className="grid gap-3">
              {libraryRows.map((row) => (
                <div
                  key={row.title}
                  className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3"
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

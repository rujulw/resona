export function QueuePage() {
  return (
    <div className="grid gap-6 px-6 py-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">queue</p>
          <h2 className="mt-2 text-3xl font-medium tracking-[-0.04em] text-[#f2f2f2]">
            playback queue
          </h2>
        </div>
      </header>

      <section className="grid place-items-center rounded-3xl border border-white/6 bg-[#1b1b1b] px-6 py-16">
        <div className="grid max-w-md gap-2 text-center">
          <h2 className="m-0 text-xl font-medium text-[#f2f2f2]">queue coming next</h2>
          <p className="m-0 text-sm text-[#8f8f8f]">
            This route is ready for queue data and transport-aware actions.
          </p>
        </div>
      </section>
    </div>
  );
}

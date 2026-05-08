import { useEffect, useState } from "react";

import {
  getArtistsImagesDir,
  pickArtistsImagesDir,
  setArtistsImagesDir,
} from "../desktop";
import type { LibraryRow } from "../desktop";
import type { ScanState } from "../types/app";

export function SettingsPage({
  libraryRows,
  libraryPath,
  platformLabel,
  appVersion,
  scanState,
  onPickLibraryDirectory,
  onScan,
}: {
  libraryRows: LibraryRow[];
  libraryPath: string;
  platformLabel: string;
  appVersion: string;
  scanState: ScanState;
  onPickLibraryDirectory: () => void;
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
            <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-4">
              <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">selected folder</p>
              <p className="mt-2 text-sm text-[#e5e5e5]">
                {libraryPath || "No folder selected yet"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="rounded-2xl border border-white/8 bg-white/3 px-4 py-3 text-sm text-[#f2f2f2] transition-colors hover:border-white/12"
                type="button"
                onClick={onPickLibraryDirectory}
                disabled={scanState.status === "running"}
              >
                choose folder
              </button>
              <button
                className="rounded-2xl border border-white/8 bg-[#272727] px-4 py-3 text-sm text-[#f2f2f2] transition-colors hover:border-white/12 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={onScan}
                disabled={scanState.status === "running" || !libraryPath}
              >
                {scanState.status === "running" ? "scanning..." : "scan library"}
              </button>
            </div>
            {scanState.message ? (
              <p className="m-0 text-sm text-[#8f8f8f]">{scanState.message}</p>
            ) : null}
            {scanState.lastScan ? (
              <div className="grid gap-4 rounded-2xl border border-white/8 bg-white/3 px-4 py-4">
                <div className="grid gap-1">
                  <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">last import</p>
                  <p className="m-0 text-base text-[#f2f2f2]">
                    {scanState.lastScan.libraryRootName}
                  </p>
                  <p className="m-0 break-all text-sm text-[#8f8f8f]">
                    {scanState.lastScan.rootPath}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatusCount
                    label="found"
                    value={scanState.lastScan.discoveredTracks}
                  />
                  <StatusCount
                    label="new"
                    value={scanState.lastScan.insertedTracks}
                  />
                  <StatusCount
                    label="updated"
                    value={scanState.lastScan.updatedTracks}
                  />
                  <StatusCount
                    label="removed"
                    value={scanState.lastScan.removedTracks}
                  />
                </div>
              </div>
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

      <ArtistImagesDirSection />
    </div>
  );
}

function ArtistImagesDirSection() {
  const [dirPath, setDirPath] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    void getArtistsImagesDir().then((path) => setDirPath(path ?? ""));
  }, []);

  const handleBrowse = () => {
    void pickArtistsImagesDir(dirPath || null).then((path) => {
      if (!path) return;
      setSaveStatus("saving");
      void setArtistsImagesDir(path)
        .then(() => {
          setDirPath(path);
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        })
        .catch(() => {
          setSaveStatus("error");
          setTimeout(() => setSaveStatus("idle"), 3000);
        });
    });
  };

  return (
    <div className="rounded-3xl border border-white/6 bg-[#1b1b1b] p-5">
      <div className="grid gap-4">
        <div>
          <p className="m-0 text-[11px] tracking-[0.08em] text-[#8f8f8f]">artist</p>
          <h3 className="text-lg font-medium text-[#f2f2f2]">artist images</h3>
        </div>
        <p className="m-0 text-sm text-[#8f8f8f]">
          Point to a folder of artist images. Each file should be named{" "}
          <span className="font-medium text-[#d4d4d4]">artist name.png</span> — the app maps them
          automatically so every artist page picks up its header image.
        </p>
        <div className="flex min-w-0 gap-2">
          <input
            className="min-w-0 flex-1 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-[#f2f2f2] outline-none placeholder:text-[#6f6f6f]"
            type="text"
            placeholder="No folder selected"
            value={dirPath}
            readOnly
          />
          <button
            className="shrink-0 rounded-2xl border border-white/8 bg-white/3 px-4 py-3 text-sm text-[#f2f2f2] transition-colors hover:border-white/12"
            type="button"
            onClick={handleBrowse}
          >
            browse
          </button>
        </div>
        {saveStatus === "saved" && <p className="m-0 text-sm text-[#8f8f8f]">Saved.</p>}
        {saveStatus === "error" && <p className="m-0 text-sm text-[#8f8f8f]">Failed to save.</p>}
      </div>
    </div>
  );
}

function StatusCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/6 bg-[#171717] px-4 py-3">
      <p className="m-0 text-[11px] text-[#8f8f8f]">{label}</p>
      <p className="mt-1 text-2xl font-medium tracking-[-0.04em] text-[#f2f2f2]">{value}</p>
    </div>
  );
}

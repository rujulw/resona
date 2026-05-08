import { useEffect, useState } from "react";
import { FolderOpen, RefreshCw } from "lucide-react";

import {
  getArtistsImagesDir,
  pickArtistsImagesDir,
  setArtistsImagesDir,
} from "../desktop";
import type { ScanState } from "../types/app";

export function SettingsPage({
  libraryPath,
  platformLabel,
  appVersion,
  scanState,
  onPickLibraryDirectory,
  onScan,
}: {
  libraryPath: string;
  platformLabel: string;
  appVersion: string;
  scanState: ScanState;
  onPickLibraryDirectory: () => void;
  onScan: () => void;
}) {
  const [dirPath, setDirPath] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    void getArtistsImagesDir().then((path) => setDirPath(path ?? ""));
  }, []);

  const handleBrowseArtistImages = () => {
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
    <div className="h-full min-h-0 overflow-y-auto bg-black [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <header className="flex flex-wrap items-end justify-between gap-6 bg-gradient-to-b from-white/[0.07] to-transparent px-8 pb-6 pt-10">
        <div>
          <h2 className="mt-1 text-7xl font-bold tracking-[-0.04em] text-white">settings</h2>
        </div>
        <span className="shrink-0 text-[11px] text-[#3f3f3f]">
          {platformLabel} · v{appVersion}
        </span>
      </header>

      <section>
        <SettingRow
          label="Library folder"
          value={libraryPath || "No folder selected"}
          actions={
            <>
              <ActionButton
                icon={<FolderOpen className="h-4 w-4" />}
                onClick={onPickLibraryDirectory}
                disabled={scanState.status === "running"}
                ariaLabel="choose folder"
              />
              <ActionButton
                icon={<RefreshCw className="h-4 w-4" />}
                onClick={onScan}
                disabled={scanState.status === "running" || !libraryPath}
                ariaLabel="scan library"
              />
            </>
          }
        />

        {scanState.message ? (
          <p className="px-8 pb-4 text-[13px] text-[#6f6f6f]">{scanState.message}</p>
        ) : null}

        {scanState.lastScan ? (
          <div className="mx-8 mb-5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-4">
            <p className="text-[11px] tracking-[0.08em] text-[#6f6f6f]">last scan</p>
            <p className="mt-1 break-all text-[13px] text-[#a5a5a5]">
              {scanState.lastScan.rootPath}
            </p>
            <div className="mt-3 flex flex-wrap gap-6">
              {(
                [
                  ["found", scanState.lastScan.discoveredTracks],
                  ["new", scanState.lastScan.insertedTracks],
                  ["updated", scanState.lastScan.updatedTracks],
                  ["removed", scanState.lastScan.removedTracks],
                ] as [string, number][]
              ).map(([label, value]) => (
                <div key={label} className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-[-0.04em] text-[#f2f2f2]">
                    {value}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.1em] text-[#6f6f6f]">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section>
        <SettingRow
          label="Artist banners folder"
          value={dirPath || "No folder selected"}
          actions={
            <ActionButton
              icon={<FolderOpen className="h-4 w-4" />}
              onClick={handleBrowseArtistImages}
              disabled={saveStatus === "saving"}
              ariaLabel="browse"
            />
          }
        />

        {saveStatus === "saved" ? (
          <p className="px-8 pb-4 text-[13px] text-[#6f6f6f]">Saved.</p>
        ) : null}
        {saveStatus === "error" ? (
          <p className="px-8 pb-4 text-[13px] text-[#6f6f6f]">Failed to save.</p>
        ) : null}
      </section>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-white/10 px-8 py-3 text-[11px] tracking-[0.08em] text-[#a5a5a5]">
      {children}
    </div>
  );
}

function SettingRow({
  label,
  value,
  actions,
}: {
  label: string;
  value: string;
  actions: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 border-t border-white/[0.05] px-8 py-5">
      <div className="grid min-w-0 flex-1 gap-1">
        <span className="text-[15px] font-medium text-[#f2f2f2]">{label}</span>
        <span className="break-all text-[13px] text-[#a5a5a5]">{value}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </div>
  );
}

function ActionButton({
  icon,
  onClick,
  disabled,
  ariaLabel,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-[#1c1c1c] p-2 text-[#d4d4d4] transition-colors hover:border-white/[0.14] hover:bg-[#272727] disabled:cursor-not-allowed disabled:opacity-40"
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
    </button>
  );
}

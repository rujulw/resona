import { useEffect, useState } from "react";
import { Download, FolderOpen, RefreshCw } from "lucide-react";

import {
  getArtistsImagesDir,
  getArtistsProfileImagesDir,
  importSpotifyHistoryFolder,
  pickArtistsImagesDir,
  pickArtistsProfileImagesDir,
  pickSpotifyExportFolder,
  setArtistsImagesDir,
  setArtistsProfileImagesDir,
} from "../desktop";
import type { SpotifyImportResult } from "../desktop";
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
  // Artist banner images (ArtistPage hero)
  const [bannerDirPath, setBannerDirPath] = useState("");
  const [bannerSaveStatus, setBannerSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  // Artist profile pictures (Analytics circles)
  const [profileDirPath, setProfileDirPath] = useState("");
  const [profileSaveStatus, setProfileSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  // Spotify folder import
  const [spotifyFolderPath, setSpotifyFolderPath] = useState("");
  const [importStatus, setImportStatus] = useState<
    "idle" | "importing" | "done" | "error"
  >("idle");
  const [importResult, setImportResult] = useState<SpotifyImportResult | null>(null);
  const [importError, setImportError] = useState("");

  useEffect(() => {
    void getArtistsImagesDir().then((p) => setBannerDirPath(p ?? ""));
    void getArtistsProfileImagesDir().then((p) => setProfileDirPath(p ?? ""));
  }, []);

  const handleBrowseBannerImages = () => {
    void pickArtistsImagesDir(bannerDirPath || null).then((path) => {
      if (!path) return;
      setBannerSaveStatus("saving");
      void setArtistsImagesDir(path)
        .then(() => {
          setBannerDirPath(path);
          setBannerSaveStatus("saved");
          setTimeout(() => setBannerSaveStatus("idle"), 2000);
        })
        .catch(() => {
          setBannerSaveStatus("error");
          setTimeout(() => setBannerSaveStatus("idle"), 3000);
        });
    });
  };

  const handleBrowseProfileImages = () => {
    void pickArtistsProfileImagesDir(profileDirPath || null).then((path) => {
      if (!path) return;
      setProfileSaveStatus("saving");
      void setArtistsProfileImagesDir(path)
        .then(() => {
          setProfileDirPath(path);
          setProfileSaveStatus("saved");
          setTimeout(() => setProfileSaveStatus("idle"), 2000);
        })
        .catch(() => {
          setProfileSaveStatus("error");
          setTimeout(() => setProfileSaveStatus("idle"), 3000);
        });
    });
  };

  const handlePickSpotifyFolder = () => {
    void pickSpotifyExportFolder().then((path) => {
      if (path) setSpotifyFolderPath(path);
    });
  };

  const handleImport = () => {
    if (!spotifyFolderPath) return;
    setImportStatus("importing");
    setImportResult(null);
    setImportError("");
    void importSpotifyHistoryFolder(spotifyFolderPath)
      .then((result) => {
        setImportResult(result);
        setImportStatus("done");
      })
      .catch((err: unknown) => {
        setImportError(String(err));
        setImportStatus("error");
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

      {/* Library */}
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
                ariaLabel="choose library folder"
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

      {/* Artist images */}
      <section>
        <SectionHeader>artists</SectionHeader>

        <SettingRow
          label="Banner images"
          sublabel="Full-width photos shown on the artist page"
          value={bannerDirPath || "No folder selected"}
          actions={
            <ActionButton
              icon={<FolderOpen className="h-4 w-4" />}
              onClick={handleBrowseBannerImages}
              disabled={bannerSaveStatus === "saving"}
              ariaLabel="browse banner images"
            />
          }
        />
        {bannerSaveStatus === "saved" ? (
          <p className="px-8 pb-4 text-[13px] text-[#6f6f6f]">Saved.</p>
        ) : null}
        {bannerSaveStatus === "error" ? (
          <p className="px-8 pb-4 text-[13px] text-[#6f6f6f]">Failed to save.</p>
        ) : null}

        <SettingRow
          label="Profile pictures"
          sublabel="Square photos shown as circles on the analytics page"
          value={profileDirPath || "No folder selected"}
          actions={
            <ActionButton
              icon={<FolderOpen className="h-4 w-4" />}
              onClick={handleBrowseProfileImages}
              disabled={profileSaveStatus === "saving"}
              ariaLabel="browse profile pictures"
            />
          }
        />
        {profileSaveStatus === "saved" ? (
          <p className="px-8 pb-4 text-[13px] text-[#6f6f6f]">Saved.</p>
        ) : null}
        {profileSaveStatus === "error" ? (
          <p className="px-8 pb-4 text-[13px] text-[#6f6f6f]">Failed to save.</p>
        ) : null}
      </section>

      {/* Spotify import */}
      <section>
        <SectionHeader>import</SectionHeader>

        <SettingRow
          label="Spotify listening history"
          sublabel="Point to your extracted Spotify GDPR export folder — all Streaming_History_Audio_*.json files will be imported"
          value={spotifyFolderPath || "No folder selected"}
          actions={
            <>
              <ActionButton
                icon={<FolderOpen className="h-4 w-4" />}
                onClick={handlePickSpotifyFolder}
                disabled={importStatus === "importing"}
                ariaLabel="choose spotify folder"
              />
              <ActionButton
                icon={<Download className="h-4 w-4" />}
                onClick={handleImport}
                disabled={!spotifyFolderPath || importStatus === "importing"}
                ariaLabel="import"
              />
            </>
          }
        />

        {importStatus === "importing" ? (
          <p className="px-8 pb-4 text-[13px] text-[#6f6f6f]">Importing…</p>
        ) : null}

        {importStatus === "done" && importResult ? (
          <div className="mx-8 mb-5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-4">
            <p className="text-[11px] tracking-[0.08em] text-[#6f6f6f]">
              last import · {importResult.filesProcessed}{" "}
              {importResult.filesProcessed === 1 ? "file" : "files"}
            </p>
            <div className="mt-3 flex flex-wrap gap-6">
              {(
                [
                  ["matched", importResult.matched],
                  ["queued", importResult.ghostStored],
                  [
                    "skipped",
                    importResult.skippedShort +
                      importResult.skippedDuplicate +
                      importResult.skippedNoTrackMetadata +
                      importResult.skippedPodcast,
                  ],
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

        {importStatus === "error" ? (
          <p className="px-8 pb-4 text-[13px] text-[#6f6f6f]">{importError || "Import failed."}</p>
        ) : null}
      </section>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-white/[0.06] px-8 py-3 text-[11px] tracking-[0.08em] text-[#4a4a4a]">
      {children}
    </div>
  );
}

function SettingRow({
  label,
  sublabel,
  value,
  actions,
}: {
  label: string;
  sublabel?: string;
  value: string;
  actions: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 border-t border-white/[0.05] px-8 py-5">
      <div className="grid min-w-0 flex-1 gap-0.5">
        <span className="text-[15px] font-medium text-[#f2f2f2]">{label}</span>
        {sublabel ? (
          <span className="text-[11px] text-[#4a4a4a]">{sublabel}</span>
        ) : null}
        <span className="mt-0.5 break-all text-[13px] text-[#a5a5a5]">{value}</span>
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

import { useEffect, useState } from "react";
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import {
  bootstrapApp,
  getShellState,
  playbackAction,
  scanLocalLibrary,
  type BootstrapPayload,
  type LibraryRow,
  type NavSection,
  type PlaybackShellState,
} from "./desktop";

type BootstrapState =
  | { status: "loading" }
  | { status: "ready"; payload: BootstrapPayload }
  | { status: "error"; message: string };

type ShellState = {
  navSections: NavSection[];
  libraryRows: LibraryRow[];
  playback: PlaybackShellState;
};

type ScanState =
  | { status: "idle"; message: string }
  | { status: "running"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type RouteItem = {
  label: string;
  path: string;
};

const routeGroups: Array<{ heading: string; items: RouteItem[] }> = [
  {
    heading: "library",
    items: [{ label: "library", path: "/library" }],
  },
  {
    heading: "workspace",
    items: [
      { label: "queue", path: "/queue" },
      { label: "settings", path: "/settings" },
    ],
  },
];

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function ShellStateScreen({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-resona-925 text-resona-200">
      <div className="grid gap-2 text-center">
        <h1 className="m-0 text-3xl font-medium tracking-[-0.04em]">{title}</h1>
        {detail ? <p className="m-0 text-sm text-resona-500">{detail}</p> : null}
      </div>
    </main>
  );
}

function Sidebar({
  appName,
  runtimeLabel,
  navSections,
}: {
  appName: string;
  runtimeLabel: string;
  navSections: NavSection[];
}) {
  const supportedLabels = new Set(["tracks", "albums", "artists", "queue", "settings"]);
  const labels = new Set(navSections.map((section) => section.label.toLowerCase()));

  return (
    <aside className="grid content-start gap-6 border-r border-white/6 bg-resona-900 px-4 py-5">
      <div className="grid gap-1">
        <h1 className="m-0 text-3xl font-medium tracking-[-0.04em]">{appName}</h1>
        <p className="m-0 text-sm text-resona-500">{runtimeLabel}</p>
      </div>

      {routeGroups.map((group) => (
        <section key={group.heading} className="grid gap-3">
          <h2 className="m-0 text-sm font-medium text-resona-300">{group.heading}</h2>
          <nav className="grid gap-1" aria-label={`${group.heading} routes`}>
            {group.items.map((item) => {
              const isKnownLabel = supportedLabels.has(item.label);
              const isPresent = labels.has(item.label);

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    [
                      "rounded-xl border px-3 py-3 text-sm transition-colors",
                      isActive
                        ? "border-white/10 bg-resona-825 text-resona-100"
                        : "border-transparent bg-resona-850 text-resona-300 hover:border-white/8 hover:text-resona-100",
                    ].join(" ")
                  }
                >
                  <span className="block">{item.label}</span>
                  <span className="mt-1 block text-xs text-resona-500">
                    {isKnownLabel && isPresent ? "route ready" : "route scaffold"}
                  </span>
                </NavLink>
              );
            })}
          </nav>
        </section>
      ))}
    </aside>
  );
}

function LibraryPage({
  libraryRows,
  libraryPath,
  scanState,
  platformLabel,
  appVersion,
  onLibraryPathChange,
  onScan,
}: {
  libraryRows: LibraryRow[];
  libraryPath: string;
  scanState: ScanState;
  platformLabel: string;
  appVersion: string;
  onLibraryPathChange: (value: string) => void;
  onScan: () => void;
}) {
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/6 px-6 py-5">
        <div className="grid min-w-0 flex-1 gap-3">
          <div className="grid gap-1">
            <h2 className="m-0 text-sm font-medium text-resona-300">library</h2>
            <p className="m-0 text-sm text-resona-500">
              Routed shell is in place. Folder picker lands in a later commit.
            </p>
          </div>

          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                aria-label="Temporary local library path"
                placeholder="/Users/you/Music"
                className="min-w-[240px] flex-1 rounded-xl border border-white/8 bg-resona-850 px-3 py-3 text-sm text-resona-200 outline-none placeholder:text-resona-500"
                type="text"
                value={libraryPath}
                onChange={(event) => {
                  onLibraryPathChange(event.target.value);
                }}
              />
              <button
                className="rounded-xl border border-white/8 bg-resona-825 px-4 py-3 text-sm text-resona-100 transition-colors hover:border-white/12 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={onScan}
                disabled={scanState.status === "running"}
              >
                {scanState.status === "running" ? "scanning..." : "add library"}
              </button>
            </div>
            <p className="m-0 text-sm text-resona-500">{scanState.message}</p>
          </div>
        </div>

        <p className="m-0 pt-1 text-sm text-resona-500">
          {platformLabel} • v{appVersion}
        </p>
      </header>

      <div className="min-w-0 p-6">
        <section
          aria-label="Library content placeholder"
          className="overflow-hidden rounded-2xl border border-white/6 bg-resona-875"
        >
          <div className="grid grid-cols-[minmax(220px,2fr)_minmax(140px,1.2fr)_96px] gap-4 border-b border-white/6 px-4 py-3 text-sm text-resona-500">
            <span>section</span>
            <span>status</span>
            <span>state</span>
          </div>

          {libraryRows.map((row) => (
            <div
              key={row.title}
              className="grid grid-cols-[minmax(220px,2fr)_minmax(140px,1.2fr)_96px] items-center gap-4 border-b border-white/5 px-4 py-4 last:border-b-0"
            >
              <div className="grid min-w-0 gap-1">
                <span className="text-sm text-resona-200">{row.title}</span>
                <span className="truncate text-sm text-resona-500">{row.detail}</span>
              </div>
              <span className="text-sm text-resona-300">not yet implemented</span>
              <span className="text-sm text-resona-500">{row.state}</span>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}

function QueuePage() {
  return (
    <section className="grid h-full place-items-center px-6 py-10">
      <div className="grid max-w-md gap-2 text-center">
        <h2 className="m-0 text-xl font-medium text-resona-100">queue</h2>
        <p className="m-0 text-sm text-resona-500">
          Queue routing is wired. Reorder and transport-aware queue behavior land in later
          commits.
        </p>
      </div>
    </section>
  );
}

function SettingsPage() {
  return (
    <section className="grid h-full place-items-center px-6 py-10">
      <div className="grid max-w-md gap-2 text-center">
        <h2 className="m-0 text-xl font-medium text-resona-100">settings</h2>
        <p className="m-0 text-sm text-resona-500">
          Settings routing is wired. Folder picker, playback preferences, and import controls come
          later.
        </p>
      </div>
    </section>
  );
}

function PlaybackBar({
  playback,
  onPlaybackAction,
}: {
  playback: PlaybackShellState;
  onPlaybackAction: (action: "previous" | "toggle" | "next") => void;
}) {
  const progressWidth =
    playback.durationSeconds > 0
      ? `${Math.min(100, (playback.progressSeconds / playback.durationSeconds) * 100)}%`
      : "0%";

  return (
    <footer className="col-span-full grid grid-cols-[240px_minmax(0,1fr)_220px] items-center gap-4 border-t border-white/6 bg-resona-950 pr-4">
      <div className="flex h-full min-w-0 items-center gap-3 border-r border-white/6 pl-4">
        <div className="h-11 w-11 rounded-xl border border-white/8 bg-resona-825" />
        <div className="grid min-w-0 gap-0.5">
          <strong className="truncate text-sm font-medium text-resona-100">Nothing playing</strong>
          <span className="text-sm text-resona-500">Playback bar scaffold</span>
        </div>
      </div>

      <div className="grid gap-3 px-4 py-4">
        <div className="flex justify-center gap-2">
          {[
            { action: "previous" as const, label: "<" },
            { action: "toggle" as const, label: ">" },
            { action: "next" as const, label: ">>" },
          ].map((item) => (
            <button
              key={item.action}
              className="h-10 min-w-10 rounded-full border border-white/8 bg-resona-850 text-sm text-resona-300 transition-colors hover:border-white/12 hover:text-resona-100"
              type="button"
              onClick={() => {
                onPlaybackAction(item.action);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid gap-2">
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-resona-500 transition-[width]"
              style={{ width: progressWidth }}
            />
          </div>
          <div className="flex justify-between text-xs text-resona-500">
            <span>{formatDuration(playback.progressSeconds)}</span>
            <span>{formatDuration(playback.durationSeconds)}</span>
          </div>
        </div>
      </div>

      <div className="grid justify-items-end gap-1 pr-1">
        <span className="text-xs text-resona-500">output</span>
        <span className="text-sm text-resona-300">{playback.transportLabel}</span>
      </div>
    </footer>
  );
}

function AppShell({
  payload,
  shellState,
  libraryPath,
  scanState,
  onLibraryPathChange,
  onPlaybackAction,
  onScan,
}: {
  payload: BootstrapPayload;
  shellState: ShellState;
  libraryPath: string;
  scanState: ScanState;
  onLibraryPathChange: (value: string) => void;
  onPlaybackAction: (action: "previous" | "toggle" | "next") => void;
  onScan: () => void;
}) {
  return (
    <BrowserRouter>
      <main className="grid min-h-screen grid-cols-[240px_minmax(0,1fr)] grid-rows-[1fr_88px] bg-resona-925 text-resona-200">
        <Sidebar
          appName={payload.appName}
          runtimeLabel={`${payload.runtime.desktopShell} bootstrap ready`}
          navSections={shellState.navSections}
        />

        <section className="grid min-w-0 grid-rows-[1fr] bg-resona-925">
          <Routes>
            <Route path="/" element={<Navigate to="/library" replace />} />
            <Route
              path="/library"
              element={
                <LibraryPage
                  libraryRows={shellState.libraryRows}
                  libraryPath={libraryPath}
                  scanState={scanState}
                  platformLabel={payload.platform}
                  appVersion={payload.appVersion}
                  onLibraryPathChange={onLibraryPathChange}
                  onScan={onScan}
                />
              }
            />
            <Route path="/queue" element={<QueuePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/library" replace />} />
          </Routes>
        </section>

        <PlaybackBar playback={shellState.playback} onPlaybackAction={onPlaybackAction} />
      </main>
    </BrowserRouter>
  );
}

export default function App() {
  const [state, setState] = useState<BootstrapState>({ status: "loading" });
  const [shellState, setShellState] = useState<ShellState | null>(null);
  const [libraryPath, setLibraryPath] = useState("");
  const [scanState, setScanState] = useState<ScanState>({
    status: "idle",
    message: "Temporary developer path until the folder picker lands.",
  });

  useEffect(() => {
    let cancelled = false;

    void Promise.all([bootstrapApp(), getShellState()])
      .then(([payload, shellPayload]) => {
        if (cancelled) {
          return;
        }

        document.title = payload.windowTitle;
        setState({ status: "ready", payload });
        setShellState({
          navSections: shellPayload.navSections,
          libraryRows: shellPayload.libraryRows,
          playback: shellPayload.playback,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Failed to bootstrap app";
        setState({ status: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshShellState = () => {
    void getShellState().then((shellPayload) => {
      setShellState((existing) => ({
        navSections: shellPayload.navSections,
        libraryRows: shellPayload.libraryRows,
        playback: existing?.playback ?? shellPayload.playback,
      }));
    });
  };

  const handlePlaybackAction = (action: "previous" | "toggle" | "next") => {
    void playbackAction(action).then((playback) => {
      setShellState((existing) => {
        if (!existing) {
          return existing;
        }

        return {
          ...existing,
          playback,
        };
      });
    });
  };

  const handleScan = () => {
    const trimmedPath = libraryPath.trim();
    if (!trimmedPath) {
      setScanState({
        status: "error",
        message: "Enter a local folder path for this temporary scaffold.",
      });
      return;
    }

    setScanState({
      status: "running",
      message: "Scanning local library...",
    });

    void scanLocalLibrary(trimmedPath)
      .then((summary) => {
        setScanState({
          status: "success",
          message: `Indexed ${summary.discoveredTracks} track(s) from ${summary.libraryRootName}.`,
        });
        refreshShellState();
      })
      .catch((error: unknown) => {
        setScanState({
          status: "error",
          message:
            error instanceof Error ? error.message : "Failed to scan local library.",
        });
      });
  };

  if (state.status === "loading") {
    return <ShellStateScreen title="resona" />;
  }

  if (state.status === "error") {
    return <ShellStateScreen title="resona" detail={state.message} />;
  }

  if (!shellState) {
    return <ShellStateScreen title={state.payload.appName} />;
  }

  return (
    <AppShell
      payload={state.payload}
      shellState={shellState}
      libraryPath={libraryPath}
      scanState={scanState}
      onLibraryPathChange={setLibraryPath}
      onPlaybackAction={handlePlaybackAction}
      onScan={handleScan}
    />
  );
}

import { useEffect, useState } from "react";

import { bootstrapApp, type BootstrapPayload } from "./desktop";

const appSurfaceStyle = {
  minHeight: "100vh",
  display: "grid",
  gridTemplateColumns: "240px minmax(0, 1fr)",
  gridTemplateRows: "1fr 88px",
  margin: 0,
  background: "#151515",
  color: "#e5e5e5",
  fontFamily: "system-ui, sans-serif",
} as const;

const centeredStateStyle = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  margin: 0,
  background: "#151515",
  color: "#e5e5e5",
  fontFamily: "system-ui, sans-serif",
} as const;

const stackStyle = {
  display: "grid",
  gap: "0.55rem",
  justifyItems: "center",
  textAlign: "center",
} as const;

const headingStyle = {
  margin: 0,
  fontSize: "2rem",
  fontWeight: 500,
  letterSpacing: "-0.04em",
} as const;

const metaStyle = {
  margin: 0,
  color: "#8f8f8f",
  fontSize: "0.95rem",
} as const;

const sidebarStyle = {
  display: "grid",
  alignContent: "start",
  gap: "1.5rem",
  padding: "1.25rem 1rem 1rem",
  borderRight: "1px solid rgba(255, 255, 255, 0.06)",
  background: "#171717",
} as const;

const brandBlockStyle = {
  display: "grid",
  gap: "0.4rem",
} as const;

const eyebrowStyle = {
  margin: 0,
  color: "#7b7b7b",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
} as const;

const sectionTitleStyle = {
  margin: 0,
  fontSize: "0.9rem",
  fontWeight: 500,
  color: "#d9d9d9",
} as const;

const navListStyle = {
  display: "grid",
  gap: "0.35rem",
} as const;

const navItemStyle = {
  padding: "0.72rem 0.8rem",
  borderRadius: "0.7rem",
  color: "#bcbcbc",
  background: "#1e1e1e",
  border: "1px solid transparent",
} as const;

const navItemActiveStyle = {
  ...navItemStyle,
  color: "#ededed",
  background: "#242424",
  border: "1px solid rgba(255, 255, 255, 0.08)",
} as const;

const mainPaneStyle = {
  display: "grid",
  minWidth: 0,
  gridTemplateRows: "auto 1fr",
  background: "#151515",
} as const;

const paneHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
  padding: "1.25rem 1.5rem 1rem",
  borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
} as const;

const headerTextBlockStyle = {
  display: "grid",
  gap: "0.35rem",
} as const;

const mutedLabelStyle = {
  margin: 0,
  color: "#8a8a8a",
  fontSize: "0.85rem",
} as const;

const libraryPaneStyle = {
  padding: "1rem 1.5rem 1.5rem",
  minWidth: 0,
} as const;

const panelStyle = {
  height: "100%",
  borderRadius: "1rem",
  border: "1px solid rgba(255, 255, 255, 0.06)",
  background: "#1a1a1a",
  overflow: "hidden",
} as const;

const tableHeaderStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 2fr) minmax(140px, 1.2fr) 96px",
  gap: "1rem",
  padding: "0.9rem 1rem",
  borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
  color: "#7f7f7f",
  fontSize: "0.85rem",
  fontWeight: 400,
} as const;

const rowStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 2fr) minmax(140px, 1.2fr) 96px",
  gap: "1rem",
  alignItems: "center",
  padding: "1rem",
  borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
} as const;

const playbackBarStyle = {
  gridColumn: "1 / -1",
  display: "grid",
  gridTemplateColumns: "240px minmax(0, 1fr) 220px",
  alignItems: "center",
  gap: "1rem",
  padding: "0 1rem 0 0",
  borderTop: "1px solid rgba(255, 255, 255, 0.06)",
  background: "#121212",
} as const;

const playbackSectionStyle = {
  display: "flex",
  alignItems: "center",
  gap: "0.8rem",
  minWidth: 0,
} as const;

const buttonGroupStyle = {
  display: "flex",
  justifyContent: "center",
  gap: "0.6rem",
} as const;

const playbackButtonStyle = {
  minWidth: "2.5rem",
  height: "2.5rem",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "999px",
  background: "#1f1f1f",
  color: "#dcdcdc",
  font: "inherit",
} as const;

const progressTrackStyle = {
  position: "relative",
  width: "100%",
  height: "4px",
  borderRadius: "999px",
  background: "#2a2a2a",
  overflow: "hidden",
} as const;

const progressFillStyle = {
  width: "28%",
  height: "100%",
  borderRadius: "999px",
  background: "#8d8d8d",
} as const;

const libraryRows = [
  { title: "Library", detail: "No tracks loaded yet", state: "Idle" },
  { title: "atlas", detail: "Remote source not connected", state: "Idle" },
  { title: "timbre", detail: "Analysis queue unavailable", state: "Idle" },
];

type BootstrapState =
  | { status: "loading" }
  | { status: "ready"; payload: BootstrapPayload }
  | { status: "error"; message: string };

export default function App() {
  const [state, setState] = useState<BootstrapState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    void bootstrapApp()
      .then((payload) => {
        if (cancelled) {
          return;
        }

        document.title = payload.windowTitle;
        setState({ status: "ready", payload });
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

  if (state.status === "loading") {
    return (
      <main style={centeredStateStyle}>
        <div style={stackStyle}>
          <h1 style={headingStyle}>resona</h1>
        </div>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main style={centeredStateStyle}>
        <div style={stackStyle}>
          <h1 style={headingStyle}>resona</h1>
          <p style={metaStyle}>{state.message}</p>
        </div>
      </main>
    );
  }

  const { payload } = state;

  return (
    <main style={appSurfaceStyle}>
      <aside style={sidebarStyle}>
        <div style={brandBlockStyle}>
          <h1 style={headingStyle}>{payload.appName}</h1>
          <p style={mutedLabelStyle}>
            {payload.runtime.desktopShell} bootstrap ready
          </p>
        </div>

        <section style={{ display: "grid", gap: "0.7rem" }}>
          <h2 style={sectionTitleStyle}>Library</h2>
          <nav style={navListStyle} aria-label="Library sections">
            <div style={navItemActiveStyle}>Tracks</div>
            <div style={navItemStyle}>Albums</div>
            <div style={navItemStyle}>Artists</div>
          </nav>
        </section>

        <section style={{ display: "grid", gap: "0.7rem" }}>
          <h2 style={sectionTitleStyle}>Workspace</h2>
          <nav style={navListStyle} aria-label="Workspace sections">
            <div style={navItemStyle}>Queue</div>
            <div style={navItemStyle}>Insights</div>
            <div style={navItemStyle}>Settings</div>
          </nav>
        </section>
      </aside>

      <section style={mainPaneStyle}>
        <header style={paneHeaderStyle}>
          <div style={headerTextBlockStyle}>
            <h2 style={sectionTitleStyle}>Library</h2>
          </div>
          <p style={mutedLabelStyle}>
            {payload.platform} • v{payload.appVersion}
          </p>
        </header>

        <div style={libraryPaneStyle}>
          <section style={panelStyle} aria-label="Library content placeholder">
            <div style={tableHeaderStyle}>
              <span>section</span>
              <span>status</span>
              <span>state</span>
            </div>
            {libraryRows.map((row) => (
              <div key={row.title} style={rowStyle}>
                <div style={{ display: "grid", gap: "0.2rem", minWidth: 0 }}>
                  <span style={{ fontWeight: 400 }}>{row.title}</span>
                  <span
                    style={{
                      color: "#8a8a8a",
                      fontSize: "0.9rem",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {row.detail}
                  </span>
                </div>
                <span style={{ color: "#b2b2b2" }}>not yet implemented</span>
                <span style={{ color: "#8a8a8a" }}>{row.state}</span>
              </div>
            ))}
          </section>
        </div>
      </section>

      <footer style={playbackBarStyle}>
        <div
          style={{
            ...playbackSectionStyle,
            paddingLeft: "1rem",
            borderRight: "1px solid rgba(255, 255, 255, 0.06)",
            height: "100%",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "0.75rem",
              background: "#242424",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          />
          <div style={{ display: "grid", gap: "0.15rem", minWidth: 0 }}>
            <strong style={{ fontWeight: 500 }}>Nothing playing</strong>
            <span style={{ color: "#8a8a8a", fontSize: "0.9rem" }}>
              Playback bar scaffold
            </span>
          </div>
        </div>

        <div style={{ display: "grid", gap: "0.85rem", padding: "0 1rem" }}>
          <div style={buttonGroupStyle}>
            <button style={playbackButtonStyle} type="button">
              {"<"}
            </button>
            <button style={playbackButtonStyle} type="button">
              {">"}
            </button>
            <button style={playbackButtonStyle} type="button">
              {">>"}
            </button>
          </div>
          <div style={{ display: "grid", gap: "0.45rem" }}>
            <div style={progressTrackStyle}>
              <div style={progressFillStyle} />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "#7d7d7d",
                fontSize: "0.8rem",
              }}
            >
              <span>0:00</span>
              <span>0:00</span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            justifyItems: "end",
            gap: "0.2rem",
            paddingRight: "1rem",
          }}
        >
          <span style={{ color: "#8a8a8a", fontSize: "0.85rem" }}>Output</span>
          <span style={{ color: "#d3d3d3", fontSize: "0.95rem" }}>
            {payload.runtime.core}
          </span>
        </div>
      </footer>
    </main>
  );
}

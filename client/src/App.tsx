import { useEffect, useState } from "react";

import { bootstrapApp, type BootstrapPayload } from "./desktop";

const shellStyle = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  margin: 0,
  background: "#1a1a1a",
  color: "#e5e5e5",
  fontFamily: "system-ui, sans-serif",
} as const;

const stackStyle = {
  display: "grid",
  gap: "0.5rem",
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
      <main style={shellStyle}>
        <div style={stackStyle}>
          <h1 style={headingStyle}>resona</h1>
        </div>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main style={shellStyle}>
        <div style={stackStyle}>
          <h1 style={headingStyle}>resona</h1>
          <p style={metaStyle}>{state.message}</p>
        </div>
      </main>
    );
  }

  const { payload } = state;

  return (
    <main style={shellStyle}>
      <div style={stackStyle}>
        <h1 style={headingStyle}>{payload.appName}</h1>
        <p style={metaStyle}>
          {payload.runtime.desktopShell} • {payload.platform} • v
          {payload.appVersion}
        </p>
      </div>
    </main>
  );
}

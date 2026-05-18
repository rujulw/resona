import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
const openMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: (...args: unknown[]) => openMock(...args),
}));

describe("desktop score bridge", () => {
  beforeEach(() => {
    vi.resetModules();
    invokeMock.mockReset();
    openMock.mockReset();
    delete (globalThis as typeof globalThis & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    delete (globalThis as typeof globalThis & { __TAURI__?: unknown }).__TAURI__;
  });

  it("extracts a score through the command bridge", async () => {
    invokeMock.mockResolvedValueOnce({
      sourcePath: "/Users/rujulw/Scores/prelude.musicxml",
      sourceName: "prelude.musicxml",
      sourceFormat: "musicxml",
      title: "Prelude in C",
      composer: "J. S. Bach",
      tempoBpm: 96,
      timeSignature: "4/4",
      keySignature: "C major",
      totalBeats: 8,
      totalSeconds: 5,
      partCount: 1,
      measureCount: 2,
      noteCount: 4,
      parts: [],
      events: [],
    });

    const { extractScore } = await import("./scores");
    const payload = await extractScore("/Users/rujulw/Scores/prelude.musicxml");

    expect(invokeMock).toHaveBeenCalledWith("extract_score", {
      sourcePath: "/Users/rujulw/Scores/prelude.musicxml",
    });
    expect(payload.title).toBe("Prelude in C");
  });

  it("opens a native picker for score files", async () => {
    openMock.mockResolvedValueOnce("/Users/rujulw/Scores/prelude.musicxml");

    const { pickScoreFile } = await import("./scores");
    const payload = await pickScoreFile("/Users/rujulw/Scores");

    expect(openMock).toHaveBeenCalledWith({
      title: "Choose sheet music",
      directory: false,
      multiple: false,
      recursive: false,
      defaultPath: "/Users/rujulw/Scores",
      filters: [
        {
          name: "MusicXML",
          extensions: ["musicxml", "xml", "mxl"],
        },
      ],
    });
    expect(payload).toBe("/Users/rujulw/Scores/prelude.musicxml");
  });
});

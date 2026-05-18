import { open } from "@tauri-apps/plugin-dialog";

import { invokeWithPreviewFallback } from "./runtime";
import type { ScoreDetailPayload } from "./types";
import { getPreviewExtractedScore } from "./previewRuntime";

export async function pickScoreFile(defaultPath?: string | null): Promise<string | null> {
  const selected = await open({
    title: "Choose sheet music",
    directory: false,
    multiple: false,
    recursive: false,
    defaultPath: defaultPath?.trim() ? defaultPath : undefined,
    filters: [
      {
        name: "MusicXML",
        extensions: ["musicxml", "xml", "mxl"],
      },
    ],
  });

  return typeof selected === "string" ? selected : null;
}

export async function extractScore(sourcePath: string): Promise<ScoreDetailPayload> {
  return invokeWithPreviewFallback("extract_score", { sourcePath }, () =>
    getPreviewExtractedScore(sourcePath),
  );
}

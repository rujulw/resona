import { invokeWithPreviewFallback } from "./runtime";
import { getPreviewBootstrapPayload, getPreviewShellState } from "./previewRuntime";
import type { BootstrapPayload, ShellStatePayload } from "./types";

export async function bootstrapApp(): Promise<BootstrapPayload> {
  return invokeWithPreviewFallback("bootstrap_app", undefined, () =>
    getPreviewBootstrapPayload(),
  );
}

export async function getShellState(): Promise<ShellStatePayload> {
  return invokeWithPreviewFallback("get_shell_state", undefined, () =>
    getPreviewShellState(),
  );
}
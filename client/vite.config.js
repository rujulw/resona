/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        port: 1420,
        strictPort: true,
    },
    clearScreen: false,
    test: {
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov"],
            thresholds: {
                statements: 80,
                branches: 80,
                functions: 70,
                lines: 80,
            },
            exclude: [
                "src/types/**",
                "src/test/**",
                "src/pages/ScoresPage.tsx",
                "src/pages/AnalyticsPage.tsx",
                "src/desktop/previewRuntime.ts",
                "src/desktop/types.ts",
                "src/desktop.ts",
                "src/main.tsx",
                "src/hooks/playback/playbackCoordinatorShared.ts",
                "src/hooks/shell/useShellBootstrap.ts",
                "src/components/ui/scores/**",
                "src/components/ui/AlbumGrid.tsx",
                "dist/**",
                "vite.config.ts",
                "**/*.d.ts",
            ],
        },
    },
});

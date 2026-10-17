import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
// The optional Drei StatsGl component is unused. Do not distribute its code
// until its missing upstream full notice has been resolved.
function distributionNotices(): Plugin {
  return {
    name: "holobuild-distribution-notices",
    apply: "build",
    generateBundle(_options, bundle) {
      let renderedBytes = 0;
      for (const file of Object.values(bundle))
        if (file.type === "chunk")
          for (const [id, module] of Object.entries(file.modules))
            if (
              /(?:^|\/)node_modules\/stats-gl\//.test(id.replaceAll("\\", "/"))
            )
              renderedBytes += module.renderedLength;
      if (renderedBytes > 0)
        this.error(
          "stats-gl entered the distributed bundle; obtain its upstream full notice before shipping.",
        );
      this.emitFile({
        type: "asset",
        fileName: "third-party-notices/distribution.json",
        source: JSON.stringify(
          {
            excluded: [
              {
                package: "stats-gl",
                renderedBytes,
                reason:
                  "Unused optional Drei StatsGl component; tree-shaken. Full upstream notice absent, so build fails if its code is included.",
              },
            ],
          },
          null,
          2,
        ),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), distributionNotices()],
  worker: { format: "es" },
  server: {
    proxy: {
      "/api/planner": { target: "http://127.0.0.1:5180", changeOrigin: true },
    },
  },
  preview: {
    proxy: {
      "/api/planner": { target: "http://127.0.0.1:5180", changeOrigin: true },
    },
  },
  test: { include: ["tests/unit/**/*.test.ts"] },
});

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { randomUUID } from "node:crypto";
import type { ProxyOptions } from "vite";
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

const plannerProxy: ProxyOptions = {
  target: "http://127.0.0.1:5180",
  changeOrigin: true,
  configure(proxy) {
    proxy.on("error", (_error, _request, response) => {
      if (
        "writeHead" in response &&
        !response.headersSent &&
        !response.writableEnded
      ) {
        const requestId = randomUUID();
        response.writeHead(503, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "X-Request-ID": requestId,
        });
        response.end(
          JSON.stringify({
            kind: "local-planner-unavailable",
            status: 503,
            requestId,
            error:
              "The local planner is unavailable on port 5180. Start both services with npm run dev:local, then check Connection in AI Settings. Offline supports basic templates and explicit edits, not this same complex request.",
          }),
        );
      }
    });
  },
};
export default defineConfig({
  plugins: [react(), distributionNotices()],
  worker: { format: "es" },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const path = id.replaceAll("\\", "/");
          if (/\/node_modules\/three\/(?:build|src)\//.test(path))
            return "three-vendor";
          if (/\/node_modules\/(?:react|react-dom|scheduler)\//.test(path))
            return "react-vendor";
        },
      },
    },
  },
  server: {
    proxy: {
      "/api/planner": plannerProxy,
    },
  },
  preview: {
    proxy: {
      "/api/planner": plannerProxy,
    },
  },
  test: { include: ["tests/unit/**/*.test.ts"] },
});

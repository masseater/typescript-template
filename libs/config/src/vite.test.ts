import type { Plugin, ViteDevServer } from "vite-plus";
import { describe, expect, it } from "vite-plus/test";
import { createServer } from "vite-plus";
import { localRuntimeToolsOnLoopback } from "./vite.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { request } from "node:http";

interface ToolResponse {
  readonly body: string;
  readonly status: number;
}

const OK = 200;
const NOT_FOUND = 404;
const toolPath = "/cdn-cgi/explorer/api/d1/database";

function runtimeTool(): Plugin {
  return {
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    configureServer(viteServer) {
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      viteServer.middlewares.use(toolPath, (_request, response) => {
        response.end("runtime-tool");
      });
    },
    name: "runtime-tool",
  };
}

async function fetchWithHost(port: number, host: string): Promise<ToolResponse> {
  // oxlint-disable-next-line promise/avoid-new
  return new Promise((resolve, reject) => {
    const call = request(
      { headers: { host }, host: "127.0.0.1", path: toolPath, port },
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      (response) => {
        const chunks: string[] = [];
        response.setEncoding("utf-8");
        response.on("data", (chunk: string) => {
          chunks.push(chunk);
        });
        response.on("end", () => {
          resolve({ body: chunks.join(""), status: response.statusCode ?? 0 });
        });
      },
    );
    call.on("error", reject);
    call.end();
  });
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function listeningPort(server: ViteDevServer): number {
  const address = server.httpServer?.address();
  if (address === undefined || address === null || typeof address === "string") {
    throw new Error("TEST_SERVER_ADDRESS_REQUIRED");
  }
  return address.port;
}

describe("local runtime tools", () => {
  it("answer only requests addressed to loopback", async () => {
    expect.hasAssertions();
    const server = await createServer({
      configFile: false,
      logLevel: "silent",
      plugins: [localRuntimeToolsOnLoopback(), runtimeTool()],
      server: { allowedHosts: [".local"], host: "127.0.0.1", port: 0, strictPort: true },
    });
    try {
      await server.listen();
      const port = listeningPort(server);
      await expect(fetchWithHost(port, `127.0.0.1:${port}`)).resolves.toStrictEqual({
        body: "runtime-tool",
        status: OK,
      });
      await expect(fetchWithHost(port, `localhost:${port}`)).resolves.toStrictEqual({
        body: "runtime-tool",
        status: OK,
      });
      await expect(fetchWithHost(port, "template-admin.local")).resolves.toStrictEqual({
        body: "",
        status: NOT_FOUND,
      });
    } finally {
      await server.close();
    }
  });
});

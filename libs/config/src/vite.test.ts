import { request } from "node:http";
import { createServer } from "vite-plus";
import { expect, test } from "vite-plus/test";
import { localRuntimeToolsOnLoopback } from "./vite.ts";

test("runtime tools under /cdn-cgi answer only requests addressed to loopback", async () => {
  const server = await createServer({
    configFile: false,
    logLevel: "silent",
    plugins: [
      localRuntimeToolsOnLoopback(),
      {
        name: "runtime-tool",
        configureServer(viteServer) {
          viteServer.middlewares.use("/cdn-cgi/explorer/api/d1/database", (_request, response) => {
            response.end("runtime-tool");
          });
        },
      },
    ],
    server: { host: "127.0.0.1", port: 0, strictPort: true, allowedHosts: [".local"] },
  });
  try {
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("TEST_SERVER_ADDRESS_REQUIRED");
    const fetchWithHost = (host: string) =>
      new Promise<{ status: number; body: string }>((resolve, reject) => {
        const call = request(
          {
            host: "127.0.0.1",
            port: address.port,
            path: "/cdn-cgi/explorer/api/d1/database",
            headers: { host },
          },
          (response) => {
            let body = "";
            response.setEncoding("utf8");
            response.on("data", (chunk: string) => {
              body += chunk;
            });
            response.on("end", () => resolve({ status: response.statusCode ?? 0, body }));
          },
        );
        call.on("error", reject);
        call.end();
      });
    expect(await fetchWithHost(`127.0.0.1:${address.port}`)).toEqual({
      status: 200,
      body: "runtime-tool",
    });
    expect(await fetchWithHost(`localhost:${address.port}`)).toEqual({
      status: 200,
      body: "runtime-tool",
    });
    expect(await fetchWithHost("template-admin.local")).toEqual({ status: 404, body: "" });
  } finally {
    await server.close();
  }
});

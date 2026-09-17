import { expect, test } from "vite-plus/test";
import { explorerOrigin, requestTelemetry, structuredMessage } from "./explorer.ts";

test("Local Explorer queries only target loopback HTTP app origins", () => {
  expect(explorerOrigin("http://127.0.0.1:3001/").href).toBe("http://127.0.0.1:3001/");
  for (const app of [
    "https://127.0.0.1:3001/",
    "http://mac-mini.tail2ee823.ts.net:3001/",
    "http://user:secret@127.0.0.1:3001/",
    "http://127.0.0.1:3001/cdn-cgi/local/explorer",
  ])
    expect(() => explorerOrigin(app)).toThrow("loopback");
});

test("structured console lines are decoded from the Local Explorer message encoding", () => {
  const line = JSON.stringify({ event: "application.error", request_id: "x" });
  expect(structuredMessage(JSON.stringify([line]))).toEqual({
    event: "application.error",
    request_id: "x",
  });
  expect(structuredMessage(JSON.stringify(["GET http://localhost/"]))).toBeUndefined();
  expect(structuredMessage(42)).toBeUndefined();
});

test("request lookups refuse identifiers that could widen the message match", async () => {
  await expect(requestTelemetry("http://127.0.0.1:3001/", "%")).rejects.toThrow(
    "Invalid request ID",
  );
});

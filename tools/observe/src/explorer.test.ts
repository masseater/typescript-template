import { describe, expect, it } from "vite-plus/test";
import { explorerOrigin, requestTelemetry, withEvent } from "./explorer.ts";

const loopbackApp = "http://127.0.0.1:3001/";
const unrelatedMessage = 42;

describe("local explorer queries", () => {
  it("only target loopback HTTP app origins", () => {
    expect.hasAssertions();
    expect(explorerOrigin(loopbackApp).href).toBe(loopbackApp);
    for (const app of [
      "https://127.0.0.1:3001/",
      "http://mac-mini.tail2ee823.ts.net:3001/",
      "http://user:secret@127.0.0.1:3001/",
      "http://127.0.0.1:3001/cdn-cgi/local/explorer",
    ]) {
      expect(() => explorerOrigin(app)).toThrow("loopback");
    }
  });

  it("decodes structured console lines from the Local Explorer message encoding", () => {
    expect.hasAssertions();
    const line = JSON.stringify({ event: "application.error", request_id: "x" });
    expect(withEvent({ message: JSON.stringify([line]), trace_id: "t" })).toStrictEqual({
      event: { event: "application.error", request_id: "x" },
      trace_id: "t",
    });
    expect(withEvent({ message: JSON.stringify(["GET http://localhost/"]) }).event).toBeUndefined();
    expect(withEvent({ message: unrelatedMessage }).event).toBeUndefined();
  });

  it("refuses request identifiers that could widen the message match", async () => {
    expect.hasAssertions();
    await expect(requestTelemetry(loopbackApp, "%")).rejects.toThrow("Invalid request ID");
  });
});

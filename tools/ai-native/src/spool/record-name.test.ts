import { describe, expect, test } from "vite-plus/test";

import { dateFrom } from "../host.ts";
import { recordNameOf } from "./record-name.ts";

describe("recordNameOf", () => {
  describe("a command stamped at a fixed instant with a fixed unique part", () => {
    const it = test.extend("theRecordNameOfASeamedCommand", () =>
      recordNameOf({
        stampedInstant: dateFrom("2026-08-11T12:00:00.789Z"),
        command: ["node", "-e", "console.log(1)"],
        uniqueSuffix: "cafe0123",
      }),
    );

    it("names the record by the instant, the command and the unique part", ({
      theRecordNameOfASeamedCommand,
    }) => {
      expect(theRecordNameOfASeamedCommand).toBe("20260811T120000Z-node--e-cafe0123.log");
    });
  });

  describe("a command whose identifier runs past forty characters", () => {
    const it = test.extend("theRecordNameOfALongCommand", () =>
      recordNameOf({
        stampedInstant: dateFrom("2026-08-11T12:00:00.789Z"),
        command: ["node", `${"x".repeat(60)}.js`],
        uniqueSuffix: "cafe0123",
      }),
    );

    it("cuts the identifier at forty characters", ({ theRecordNameOfALongCommand }) => {
      expect(theRecordNameOfALongCommand).toBe(
        `20260811T120000Z-node-${"x".repeat(35)}-cafe0123.log`,
      );
    });
  });
});

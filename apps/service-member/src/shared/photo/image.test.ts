import { PHOTO_CONTENT_TYPE } from "@repo/config";
import { describe, expect, it } from "vite-plus/test";

import {
  bytesOf,
  containsExifMarker,
  jpegMarkers,
  jpegSegment,
  jpegWithExif,
  pngChunkTypes,
  pngWithText,
  webpChunkTypes,
  webpWithExif,
} from "./image-test-fixture.ts";
import { sanitizeImage } from "./image.ts";

const jpegExifMarker = 0xe1;
const jpegCommentMarker = 0xfe;
const ascii = new TextEncoder();
const jpegStart = [0xff, 0xd8];
const jpegEnd = [0xff, 0xd9];
const jpegScan = bytesOf(jpegSegment(0xda, [1, 1, 0, 0, 63, 0]), [0x12, 0xff, 0x00, 0x34]);

describe("sanitizeImage", () => {
  it("drops the EXIF APP1 and comment segments from a JPEG and keeps the picture", () => {
    expect.hasAssertions();
    expect(containsExifMarker(jpegWithExif)).toBe(true);
    const sanitized = sanitizeImage(jpegWithExif);
    expect(sanitized?.contentType).toBe(PHOTO_CONTENT_TYPE.jpeg);
    const markers = jpegMarkers(sanitized?.bytes ?? new Uint8Array());
    expect(markers).not.toContain(jpegExifMarker);
    expect(markers).not.toContain(jpegCommentMarker);
    expect(markers).toStrictEqual([0xe0, 0xdb, 0xc0, 0xc4, 0xda, 0xd9]);
    expect(containsExifMarker(sanitized?.bytes ?? new Uint8Array())).toBe(false);
  });

  it("keeps colour profiles, restart markers, and the scan while dropping fill bytes and other APP segments", () => {
    expect.hasAssertions();
    const iccProfile = jpegSegment(0xe2, bytesOf(ascii.encode("ICC_PROFILE\0"), [1, 1]));
    const flashpix = jpegSegment(0xe2, ascii.encode("FPXR\0"));
    const adobe = jpegSegment(0xee, ascii.encode("Adobe"));
    const ducky = jpegSegment(0xec, ascii.encode("Ducky"));
    const restart = [0xff, 0xd0];
    const jpeg = bytesOf(
      jpegStart,
      iccProfile,
      flashpix,
      [0xff],
      adobe,
      ducky,
      restart,
      jpegScan,
      jpegEnd,
    );
    expect(sanitizeImage(jpeg)?.bytes).toStrictEqual(
      bytesOf(jpegStart, iccProfile, adobe, restart, jpegScan, jpegEnd),
    );
  });

  it("drops text, XMP, and EXIF chunks from a PNG and keeps the critical chunks", () => {
    expect.hasAssertions();
    const sanitized = sanitizeImage(pngWithText);
    expect(sanitized?.contentType).toBe(PHOTO_CONTENT_TYPE.png);
    expect(pngChunkTypes(sanitized?.bytes ?? new Uint8Array())).toStrictEqual([
      "IHDR",
      "IDAT",
      "IEND",
    ]);
    expect(containsExifMarker(sanitized?.bytes ?? new Uint8Array())).toBe(false);
  });

  it("drops the EXIF chunk from a WebP, clears its flag, and fixes the RIFF size", () => {
    expect.hasAssertions();
    const sanitized = sanitizeImage(webpWithExif);
    expect(sanitized?.contentType).toBe(PHOTO_CONTENT_TYPE.webp);
    const bytes = sanitized?.bytes ?? new Uint8Array();
    expect(webpChunkTypes(bytes)).toStrictEqual(["VP8X", "VP8 "]);
    expect(new DataView(bytes.buffer, bytes.byteOffset).getUint32(4, true)).toBe(
      bytes.byteLength - 8,
    );
    expect(bytes[20]).toBe(0);
    expect(containsExifMarker(bytes)).toBe(false);
  });

  it.each([
    ["text", new TextEncoder().encode("hello")],
    ["a truncated JPEG", jpegWithExif.subarray(0, 12)],
    ["a JPEG without a scan", Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])],
    ["a JPEG with a stray byte between segments", bytesOf(jpegStart, [0], jpegScan, jpegEnd)],
    ["a JPEG segment running past the file", bytesOf(jpegStart, [0xff, 0xe0, 0, 64, 1, 2])],
    [
      "a JPEG segment shorter than its length field",
      bytesOf(jpegStart, [0xff, 0xe0, 0, 1], jpegEnd),
    ],
    ["a JPEG cut inside a segment length", bytesOf(jpegStart, [0xff, 0xe0, 0])],
    ["a JPEG cut after a marker prefix", bytesOf(jpegStart, [0xff])],
    ["a JPEG that never ends", bytesOf(jpegStart, jpegScan)],
    ["a PNG without IEND", pngWithText.subarray(0, pngWithText.byteLength - 12)],
    ["a RIFF that is not WebP", new TextEncoder().encode("RIFF\0\0\0\0WAVE")],
    ["an empty file", new Uint8Array()],
  ])("refuses %s", (_, bytes) => {
    expect.hasAssertions();
    expect(sanitizeImage(bytes)).toBeUndefined();
  });
});

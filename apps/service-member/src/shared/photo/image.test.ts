import { PHOTO_CONTENT_TYPE } from "@repo/config";
import { describe, expect, it } from "vite-plus/test";

import {
  containsExifMarker,
  jpegMarkers,
  jpegWithExif,
  pngChunkTypes,
  pngWithText,
  webpChunkTypes,
  webpWithExif,
} from "./image-fixture.ts";
import { sanitizeImage } from "./image.ts";

const jpegExifMarker = 0xe1;
const jpegCommentMarker = 0xfe;

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
    ["a PNG without IEND", pngWithText.subarray(0, pngWithText.byteLength - 12)],
    ["a RIFF that is not WebP", Uint8Array.from([...new TextEncoder().encode("RIFF\0\0\0\0WAVE")])],
    ["an empty file", new Uint8Array()],
  ])("refuses %s", (_, bytes) => {
    expect.hasAssertions();
    expect(sanitizeImage(bytes)).toBeUndefined();
  });
});

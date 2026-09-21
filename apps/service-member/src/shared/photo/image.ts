import { PHOTO_CONTENT_TYPE } from "@repo/config";

import type { PhotoContentType } from "@repo/config";

interface SanitizedImage {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly contentType: PhotoContentType;
}

const ascii = new TextEncoder();

function startsWith(bytes: Uint8Array, prefix: readonly number[], offset = 0): boolean {
  return prefix.every((byte, index) => bytes[offset + index] === byte);
}

function concat(parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const joined = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let position = 0;
  for (const part of parts) {
    joined.set(part, position);
    position += part.byteLength;
  }
  return joined;
}

const jpegSignature = [0xff, 0xd8];
const jpegMarkerPrefix = 0xff;
const jpegStuffedByte = 0x00;
const jpegFirstRestart = 0xd0;
const jpegLastRestart = 0xd7;
const jpegTemporary = 0x01;
const jpegStartOfScan = 0xda;
const jpegEndOfImage = 0xd9;
const jpegFirstApplication = 0xe0;
const jpegLastApplication = 0xef;
const jpegComment = 0xfe;
const jpegApplication0 = 0xe0;
const jpegApplication2 = 0xe2;
const jpegApplication14 = 0xee;
const jpegSegmentHeaderLength = 4;
const jpegMarkerLength = 2;
const jpegLengthOffset = 2;
const iccProfileLabel = ascii.encode("ICC_PROFILE\0");
const adobeLabel = ascii.encode("Adobe");

function isStandaloneJpegMarker(marker: number): boolean {
  return (
    (marker >= jpegFirstRestart && marker <= jpegLastRestart) ||
    marker === jpegTemporary ||
    marker === jpegSignature[1]
  );
}

function labelled(payload: Uint8Array, label: Uint8Array): boolean {
  return startsWith(payload, [...label]);
}

function keepsJpegSegment(marker: number, payload: Uint8Array): boolean {
  if (marker === jpegComment) {
    return false;
  }
  if (marker < jpegFirstApplication || marker > jpegLastApplication) {
    return true;
  }
  if (marker === jpegApplication0) {
    return true;
  }
  if (marker === jpegApplication2) {
    return labelled(payload, iccProfileLabel);
  }
  return marker === jpegApplication14 && labelled(payload, adobeLabel);
}

function entropyDataEnd(bytes: Uint8Array, start: number): number {
  let position = start;
  while (position < bytes.byteLength) {
    if (bytes[position] === jpegMarkerPrefix) {
      const next = bytes[position + 1];
      if (next === undefined) {
        return bytes.byteLength;
      }
      if (
        next !== jpegStuffedByte &&
        next !== jpegMarkerPrefix &&
        !(next >= jpegFirstRestart && next <= jpegLastRestart)
      ) {
        return position;
      }
    }
    position += 1;
  }
  return bytes.byteLength;
}

function sanitizeJpeg(bytes: Uint8Array): Uint8Array<ArrayBuffer> | undefined {
  const kept: Uint8Array[] = [bytes.subarray(0, jpegMarkerLength)];
  let position = jpegMarkerLength;
  let scanned = false;
  while (position < bytes.byteLength) {
    if (bytes[position] !== jpegMarkerPrefix) {
      return undefined;
    }
    const marker = bytes[position + 1];
    if (marker === undefined) {
      return undefined;
    }
    if (marker === jpegMarkerPrefix) {
      position += 1;
      continue;
    }
    if (marker === jpegEndOfImage) {
      kept.push(bytes.subarray(position, position + jpegMarkerLength));
      return scanned ? concat(kept) : undefined;
    }
    if (isStandaloneJpegMarker(marker)) {
      kept.push(bytes.subarray(position, position + jpegMarkerLength));
      position += jpegMarkerLength;
      continue;
    }
    const lengthOffset = position + jpegLengthOffset;
    const high = bytes[lengthOffset];
    const low = bytes[lengthOffset + 1];
    if (high === undefined || low === undefined) {
      return undefined;
    }
    const segmentEnd = lengthOffset + ((high << 8) | low);
    if (segmentEnd > bytes.byteLength || segmentEnd < position + jpegSegmentHeaderLength) {
      return undefined;
    }
    const payload = bytes.subarray(position + jpegSegmentHeaderLength, segmentEnd);
    if (marker === jpegStartOfScan) {
      scanned = true;
      const dataEnd = entropyDataEnd(bytes, segmentEnd);
      kept.push(bytes.subarray(position, dataEnd));
      position = dataEnd;
      continue;
    }
    if (keepsJpegSegment(marker, payload)) {
      kept.push(bytes.subarray(position, segmentEnd));
    }
    position = segmentEnd;
  }
  return undefined;
}

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const pngChunkHeaderLength = 8;
const pngChunkCrcLength = 4;
const pngKeptChunks: ReadonlySet<string> = new Set([
  "IHDR",
  "PLTE",
  "IDAT",
  "IEND",
  "tRNS",
  "gAMA",
  "cHRM",
  "sRGB",
  "iCCP",
  "sBIT",
  "bKGD",
  "pHYs",
  "hIST",
  "sPLT",
  "acTL",
  "fcTL",
  "fdAT",
]);
const pngHeaderChunk = "IHDR";
const pngEndChunk = "IEND";

function sanitizePng(bytes: Uint8Array): Uint8Array<ArrayBuffer> | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const kept: Uint8Array[] = [bytes.subarray(0, pngSignature.length)];
  let position = pngSignature.length;
  let first = true;
  while (position + pngChunkHeaderLength <= bytes.byteLength) {
    const length = view.getUint32(position);
    const type = String.fromCodePoint(
      ...bytes.subarray(position + pngChunkCrcLength, position + pngChunkHeaderLength),
    );
    const chunkEnd = position + pngChunkHeaderLength + length + pngChunkCrcLength;
    if (chunkEnd > bytes.byteLength || (first && type !== pngHeaderChunk)) {
      return undefined;
    }
    first = false;
    if (pngKeptChunks.has(type)) {
      kept.push(bytes.subarray(position, chunkEnd));
    }
    if (type === pngEndChunk) {
      return concat(kept);
    }
    position = chunkEnd;
  }
  return undefined;
}

const riffSignature = [...ascii.encode("RIFF")];
const webpSignature = [...ascii.encode("WEBP")];
const riffHeaderLength = 12;
const riffSizeOffset = 4;
const riffFormLength = 4;
const webpChunkHeaderLength = 8;
const webpKeptChunks: ReadonlySet<string> = new Set([
  "VP8 ",
  "VP8L",
  "VP8X",
  "ALPH",
  "ANIM",
  "ANMF",
  "ICCP",
]);
const webpExtendedChunk = "VP8X";
const webpExifFlag = 0b0000_1000;
const webpXmpFlag = 0b0000_0100;

function withoutMetadataFlags(chunk: Uint8Array): Uint8Array {
  const copy = Uint8Array.from(chunk);
  const flags = copy[webpChunkHeaderLength];
  if (flags !== undefined) {
    copy[webpChunkHeaderLength] = flags & ~(webpExifFlag | webpXmpFlag);
  }
  return copy;
}

function sanitizeWebp(bytes: Uint8Array): Uint8Array<ArrayBuffer> | undefined {
  if (!startsWith(bytes, webpSignature, riffSizeOffset + riffFormLength)) {
    return undefined;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const kept: Uint8Array[] = [];
  let position = riffHeaderLength;
  while (position + webpChunkHeaderLength <= bytes.byteLength) {
    const fourcc = String.fromCodePoint(...bytes.subarray(position, position + riffFormLength));
    const size = view.getUint32(position + riffFormLength, true);
    const padded = size + (size % 2);
    const chunkEnd = position + webpChunkHeaderLength + padded;
    if (chunkEnd > bytes.byteLength) {
      return undefined;
    }
    if (webpKeptChunks.has(fourcc)) {
      const chunk = bytes.subarray(position, chunkEnd);
      kept.push(fourcc === webpExtendedChunk ? withoutMetadataFlags(chunk) : chunk);
    }
    position = chunkEnd;
  }
  if (kept.length === 0) {
    return undefined;
  }
  const body = concat(kept);
  const header = new Uint8Array(riffHeaderLength);
  header.set(riffSignature, 0);
  new DataView(header.buffer).setUint32(riffSizeOffset, riffFormLength + body.byteLength, true);
  header.set(webpSignature, riffSizeOffset + riffFormLength);
  return concat([header, body]);
}

function sanitizeImage(bytes: Uint8Array): SanitizedImage | undefined {
  if (startsWith(bytes, jpegSignature)) {
    const sanitized = sanitizeJpeg(bytes);
    return sanitized && { bytes: sanitized, contentType: PHOTO_CONTENT_TYPE.jpeg };
  }
  if (startsWith(bytes, pngSignature)) {
    const sanitized = sanitizePng(bytes);
    return sanitized && { bytes: sanitized, contentType: PHOTO_CONTENT_TYPE.png };
  }
  if (startsWith(bytes, riffSignature)) {
    const sanitized = sanitizeWebp(bytes);
    return sanitized && { bytes: sanitized, contentType: PHOTO_CONTENT_TYPE.webp };
  }
  return undefined;
}

export { sanitizeImage };
export type { SanitizedImage };

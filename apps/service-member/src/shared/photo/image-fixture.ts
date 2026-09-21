const ascii = new TextEncoder();

function bytesOf(...parts: readonly (readonly number[] | Uint8Array)[]): Uint8Array<ArrayBuffer> {
  const flat = parts.flatMap((part) => [...part]);
  return Uint8Array.from(flat);
}

function bigEndian16(value: number): number[] {
  // oxlint-disable-next-line no-bitwise -- JPEG segment lengths and WebP feature flags are packed bit fields, so those values are written with bitwise operators
  return [(value >> 8) & 0xff, value & 0xff];
}

function bigEndian32(value: number): number[] {
  // oxlint-disable-next-line no-bitwise -- JPEG segment lengths and WebP feature flags are packed bit fields, so those values are written with bitwise operators
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function littleEndian32(value: number): number[] {
  return bigEndian32(value).toReversed();
}

function jpegSegment(marker: number, payload: Uint8Array | readonly number[]): Uint8Array {
  return bytesOf([0xff, marker], bigEndian16(payload.length + 2), payload);
}

const exifPayload = bytesOf(ascii.encode("Exif\0\0"), ascii.encode("MM\0*GPS 35.6 139.7"));
const commentPayload = ascii.encode("shot on a phone");
const jfifPayload = bytesOf(ascii.encode("JFIF\0"), [1, 1, 0, 0, 1, 0, 1, 0, 0]);
const quantization = bytesOf(
  [0],
  Array.from({ length: 64 }, () => 1),
);
const frame = [8, 0, 1, 0, 1, 1, 1, 0x11, 0];
const huffman = bytesOf(
  [0x00],
  Array.from({ length: 16 }, () => 0),
  [],
);
const scanHeader = [1, 1, 0, 0, 63, 0];
const entropy = [0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56];

const jpegWithExif = bytesOf(
  [0xff, 0xd8],
  jpegSegment(0xe1, exifPayload),
  jpegSegment(0xfe, commentPayload),
  jpegSegment(0xe0, jfifPayload),
  jpegSegment(0xdb, quantization),
  jpegSegment(0xc0, frame),
  jpegSegment(0xc4, huffman),
  jpegSegment(0xda, scanHeader),
  entropy,
  [0xff, 0xd9],
);

function jpegMarkers(bytes: Uint8Array): number[] {
  const markers: number[] = [];
  let position = 2;
  while (position < bytes.byteLength) {
    const marker = bytes[position + 1] ?? 0;
    markers.push(marker);
    if (marker === 0xd9) {
      break;
    }
    // oxlint-disable-next-line no-bitwise -- JPEG segment lengths and WebP feature flags are packed bit fields, so those values are written with bitwise operators
    const length = ((bytes[position + 2] ?? 0) << 8) | (bytes[position + 3] ?? 0);
    position += 2 + length;
    if (marker === 0xda) {
      while (
        position < bytes.byteLength &&
        !(bytes[position] === 0xff && bytes[position + 1] === 0xd9)
      ) {
        position += 1;
      }
    }
  }
  return markers;
}

function pngChunk(type: string, payload: Uint8Array | readonly number[]): Uint8Array {
  return bytesOf(bigEndian32(payload.length), ascii.encode(type), payload, [0, 0, 0, 0]);
}

const pngWithText = bytesOf(
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  pngChunk("IHDR", [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]),
  pngChunk("tEXt", ascii.encode("Author\0somebody")),
  pngChunk("eXIf", exifPayload),
  pngChunk("iTXt", ascii.encode("XML:com.adobe.xmp\0\0\0\0\0<x:xmpmeta/>")),
  pngChunk("IDAT", [0x78, 0x9c, 0x63, 0x60, 0x60, 0x60, 0x00, 0x00, 0x00, 0x04, 0x00, 0x01]),
  pngChunk("IEND", []),
);

function pngChunkTypes(bytes: Uint8Array): string[] {
  const types: string[] = [];
  let position = 8;
  while (position + 8 <= bytes.byteLength) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + position, 4).getUint32(0);
    types.push(String.fromCodePoint(...bytes.subarray(position + 4, position + 8)));
    position += 12 + length;
  }
  return types;
}

function webpChunk(fourcc: string, payload: Uint8Array | readonly number[]): Uint8Array {
  const padding = payload.length % 2 === 0 ? [] : [0];
  return bytesOf(ascii.encode(fourcc), littleEndian32(payload.length), payload, padding);
}

const webpExifFlag = 0b0000_1000;
const webpBody = bytesOf(
  webpChunk("VP8X", [webpExifFlag, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  webpChunk("VP8 ", [0x9d, 0x01, 0x2a, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00]),
  webpChunk("EXIF", exifPayload),
);
const webpWithExif = bytesOf(
  ascii.encode("RIFF"),
  littleEndian32(4 + webpBody.byteLength),
  ascii.encode("WEBP"),
  webpBody,
);

function webpChunkTypes(bytes: Uint8Array): string[] {
  const types: string[] = [];
  let position = 12;
  while (position + 8 <= bytes.byteLength) {
    const size = new DataView(bytes.buffer, bytes.byteOffset + position + 4, 4).getUint32(0, true);
    types.push(String.fromCodePoint(...bytes.subarray(position, position + 4)));
    position += 8 + size + (size % 2);
  }
  return types;
}

const exifMarker = ascii.encode("Exif");

function containsExifMarker(bytes: Uint8Array): boolean {
  return bytes.some((_, position) =>
    exifMarker.every((byte, offset) => bytes[position + offset] === byte),
  );
}

export {
  containsExifMarker,
  jpegMarkers,
  jpegWithExif,
  pngChunkTypes,
  pngWithText,
  webpChunkTypes,
  webpWithExif,
};

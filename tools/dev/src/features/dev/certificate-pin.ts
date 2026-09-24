function derSpan(
  bytes: Uint8Array,
  offset: number,
): { readonly header: number; readonly length: number } {
  const first = bytes[offset + 1];
  if (first === undefined) {
    throw new Error("truncated");
  }
  if (first < 0x80) {
    return { header: 2, length: first };
  }
  const size = first & 0x7f;
  let length = 0;
  for (let index = 0; index < size; index += 1) {
    const octet = bytes[offset + 2 + index];
    if (octet === undefined) {
      throw new Error("truncated");
    }
    length = (length << 8) | octet;
  }
  return { header: 2 + size, length };
}

function derChildren(bytes: Uint8Array, offset: number): readonly (readonly [number, number])[] {
  const span = derSpan(bytes, offset);
  const end = offset + span.header + span.length;
  const children: Array<readonly [number, number]> = [];
  let cursor = offset + span.header;
  while (cursor < end) {
    const child = derSpan(bytes, cursor);
    const childEnd = cursor + child.header + child.length;
    children.push([cursor, childEnd]);
    cursor = childEnd;
  }
  return children;
}

function spkiFromCertificatePem(pem: string): Uint8Array {
  const der = Buffer.from(
    pem
      .replace("-----BEGIN CERTIFICATE-----", "")
      .replace("-----END CERTIFICATE-----", "")
      .replaceAll(/\s/gu, ""),
    "base64",
  );
  const [tbs] = derChildren(der, 0);
  if (tbs === undefined) {
    throw new Error("certificate");
  }
  const fields = derChildren(der, tbs[0]);
  const first = der[fields[0]?.[0] ?? -1];
  const spki = fields[first === 0xa0 ? 6 : 5];
  if (spki === undefined) {
    throw new Error("spki");
  }
  return der.subarray(spki[0], spki[1]);
}

export { spkiFromCertificatePem };

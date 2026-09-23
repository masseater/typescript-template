import { describe, expect, it } from "vite-plus/test";

import { spkiFromCertificatePem } from "./certificate-pin.ts";

const { X509Certificate } = process.getBuiltinModule("crypto");

const versionThreeCertificate = [
  "-----BEGIN CERTIFICATE-----",
  "MIIBhTCCASugAwIBAgIUMj6ns0NTBipMg18gKVfD1vQVYhQwCgYIKoZIzj0EAwIw",
  "GDEWMBQGA1UEAwwNdGVtcGxhdGUudGVzdDAeFw0yNjA5MjMwNzU1MjRaFw0zNjA5",
  "MjAwNzU1MjRaMBgxFjAUBgNVBAMMDXRlbXBsYXRlLnRlc3QwWTATBgcqhkjOPQIB",
  "BggqhkjOPQMBBwNCAAS265hqpT1aC8JURVHbSZkdyqTOx5ZVokb0//unYNAOp3jk",
  "fiG8ntNnSnbKr4AJsY/hoJA+fjsRcRkNZuUY3XZFo1MwUTAdBgNVHQ4EFgQURRvP",
  "i0NHSjY1H582JJpId1061iAwHwYDVR0jBBgwFoAURRvPi0NHSjY1H582JJpId106",
  "1iAwDwYDVR0TAQH/BAUwAwEB/zAKBggqhkjOPQQDAgNIADBFAiEAhSnM2jvxQvsk",
  "ysYiBzd90YBzR/E48xCuPcKnzgtEqxgCIA7XTt2h1JgeYdjksPVcPpDKJnHDBByV",
  "4wYzUyNQH2KI",
  "-----END CERTIFICATE-----",
].join("\n");

const versionOneCertificate = [
  "-----BEGIN CERTIFICATE-----",
  "MIIBKjCB0QIUN6c6D26MoQJpRrzZo4BDCKPypAwwCgYIKoZIzj0EAwIwGDEWMBQG",
  "A1UEAwwNdGVtcGxhdGUudGVzdDAeFw0yNjA5MjMwNzU1MjRaFw0zNjA5MjAwNzU1",
  "MjRaMBgxFjAUBgNVBAMMDXRlbXBsYXRlLnRlc3QwWTATBgcqhkjOPQIBBggqhkjO",
  "PQMBBwNCAAS265hqpT1aC8JURVHbSZkdyqTOx5ZVokb0//unYNAOp3jkfiG8ntNn",
  "SnbKr4AJsY/hoJA+fjsRcRkNZuUY3XZFMAoGCCqGSM49BAMCA0gAMEUCIQDRsz9E",
  "i7PXcYJ3M/r+juTgo2xXwbmAJs+qAtgAx7SyEgIgfBLtV0c9xJjC2TiTivZknRfV",
  "7vkxkxjvPl6boY7IaCI=",
  "-----END CERTIFICATE-----",
].join("\n");

const publicKeyDer = (pem: string): Buffer =>
  new X509Certificate(pem).publicKey.export({ format: "der", type: "spki" });

describe("pinning a certificate by its public key", () => {
  it("reads the subject public key info after the explicit version field", () => {
    expect(Buffer.from(spkiFromCertificatePem(versionThreeCertificate))).toStrictEqual(
      publicKeyDer(versionThreeCertificate),
    );
  });

  it("reads the subject public key info of a certificate without a version field", () => {
    expect(Buffer.from(spkiFromCertificatePem(versionOneCertificate))).toStrictEqual(
      publicKeyDer(versionOneCertificate),
    );
  });

  it("refuses a certificate cut short", () => {
    expect(() => spkiFromCertificatePem(versionThreeCertificate.slice(0, 120))).toThrow(
      "truncated",
    );
  });

  it("refuses an empty document", () => {
    expect(() => spkiFromCertificatePem("")).toThrow("truncated");
  });
});

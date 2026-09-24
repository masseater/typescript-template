import { httpStatus } from "@repo/config";
import { Effect, Encoding, Redacted, Result } from "effect";
import { HttpResponse, http } from "msw";

import type { WikiPublishConfig } from "@repo/config";
import type { HttpResponseResolver, JsonBodyType } from "msw";

type GitHubCall = Readonly<{ body: unknown; path: string }>;
type Resolved = Parameters<HttpResponseResolver>[0];
type GitHubRequest = Resolved["request"];

const gitHubApi = "https://api.github.com";
const appId = "4242";
const owner = "example-owner";
const repository = "example-wiki";
const installationId = 31;
const installationToken = "ghs_fixture_installation";
const baseCommit = "c0ffee0000000000000000000000000000000000";
const baseTree = "7ree000000000000000000000000000000000000";
const createdTree = "7ree111111111111111111111111111111111111";
const createdCommit = "c1abcde111111111111111111111111111111111";
const pullRequestNumber = 7;
const pullRequestUrl = `https://github.com/${owner}/${repository}/pull/${String(pullRequestNumber)}`;
const rsaModulusLength = 2048;
const pemLineLength = 64;
const repositoryApi = `${gitHubApi}/repos/${owner}/${repository}`;

const pem = (label: string, der: ArrayBuffer): string =>
  `-----BEGIN ${label}-----\n${(Encoding.encodeBase64(new Uint8Array(der)).match(new RegExp(`.{1,${String(pemLineLength)}}`, "gu")) ?? []).join("\n")}\n-----END ${label}-----\n`;

const decodeSegment = (segment: string): Uint8Array =>
  Result.getOrElse(Encoding.decodeBase64Url(segment), () => new Uint8Array());

const signedByApp = (request: GitHubRequest, publicKey: CryptoKey): Promise<boolean> => {
  const [header = "", payload = "", signature = ""] = (request.headers.get("authorization") ?? "")
    .replace(/^Bearer /u, "")
    .split(".");
  const claims: unknown = JSON.parse(new TextDecoder().decode(decodeSegment(payload)));
  return crypto.subtle
    .verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      new Uint8Array(decodeSegment(signature)),
      new TextEncoder().encode(`${header}.${payload}`),
    )
    .then(
      (verified) =>
        verified &&
        typeof claims === "object" &&
        claims !== null &&
        Reflect.get(claims, "iss") === appId,
    );
};

const byInstallation = (request: GitHubRequest): boolean =>
  request.headers.get("authorization") === `Bearer ${installationToken}` &&
  request.headers.get("user-agent") !== null;

const refused = (): Response =>
  HttpResponse.json({ message: "Bad credentials" }, { status: httpStatus.unauthorized });

type FakeGitHubOptions = Readonly<{
  keyFormat?: "pkcs1" | "pkcs8";
  unavailableStep?: string;
}>;

const pkcs1Offset = 26;

const fakeGitHub = Effect.fn("fakeGitHub")(function* fakeGitHub(
  publishedBlob: string | null,
  { keyFormat = "pkcs8", unavailableStep }: FakeGitHubOptions = {},
) {
  const keys = yield* Effect.promise(() =>
    crypto.subtle.generateKey(
      {
        hash: "SHA-256",
        modulusLength: rsaModulusLength,
        name: "RSASSA-PKCS1-v1_5",
        publicExponent: Uint8Array.of(1, 0, 1),
      },
      true,
      ["sign", "verify"],
    ),
  );
  const pkcs8 = yield* Effect.promise(() => crypto.subtle.exportKey("pkcs8", keys.privateKey));
  const privateKey =
    keyFormat === "pkcs8"
      ? pem("PRIVATE KEY", pkcs8)
      : pem("RSA PRIVATE KEY", pkcs8.slice(pkcs1Offset));
  const calls: GitHubCall[] = [];
  const created =
    (path: string, response: JsonBodyType) =>
    ({ request }: Resolved): Promise<Response> =>
      path === unavailableStep
        ? Promise.resolve(
            HttpResponse.json(
              { message: "Service unavailable" },
              { status: httpStatus.serviceUnavailable },
            ),
          )
        : byInstallation(request)
          ? request.json().then((body: unknown) => {
              calls.push({ body, path });
              return HttpResponse.json(response, { status: httpStatus.created });
            })
          : Promise.resolve(refused());
  const read =
    (response: () => Response) =>
    ({ request }: Resolved): Response =>
      byInstallation(request) ? response() : refused();
  let blobs = 0;
  const handlers = [
    http.get(`${repositoryApi}/installation`, ({ request }) =>
      signedByApp(request, keys.publicKey).then((signed) =>
        signed ? HttpResponse.json({ id: installationId }) : refused(),
      ),
    ),
    http.post(
      `${gitHubApi}/app/installations/${String(installationId)}/access_tokens`,
      ({ request }) =>
        signedByApp(request, keys.publicKey).then((signed) =>
          signed
            ? HttpResponse.json({ token: installationToken }, { status: httpStatus.created })
            : refused(),
        ),
    ),
    http.get(
      repositoryApi,
      read(() => HttpResponse.json({ default_branch: "main" })),
    ),
    http.get(
      `${repositoryApi}/git/ref/heads/main`,
      read(() => HttpResponse.json({ object: { sha: baseCommit } })),
    ),
    http.get(
      `${repositoryApi}/git/commits/${baseCommit}`,
      read(() => HttpResponse.json({ sha: baseCommit, tree: { sha: baseTree } })),
    ),
    http.get(
      `${repositoryApi}/contents/*`,
      read(() =>
        publishedBlob === null
          ? HttpResponse.json({ message: "Not Found" }, { status: httpStatus.notFound })
          : HttpResponse.json({ sha: publishedBlob }),
      ),
    ),
    http.post(`${repositoryApi}/git/blobs`, (resolver) => {
      blobs += 1;
      return created("/git/blobs", { sha: `b10b${String(blobs)}` })(resolver);
    }),
    http.post(`${repositoryApi}/git/trees`, created("/git/trees", { sha: createdTree })),
    http.post(`${repositoryApi}/git/commits`, created("/git/commits", { sha: createdCommit })),
    http.post(
      `${repositoryApi}/git/refs`,
      created("/git/refs", { object: { sha: createdCommit } }),
    ),
    http.post(
      `${repositoryApi}/pulls`,
      created("/pulls", { html_url: pullRequestUrl, number: pullRequestNumber }),
    ),
    http.post(
      `${repositoryApi}/issues/${String(pullRequestNumber)}/labels`,
      created("/labels", [{ name: "ready-to-merge" }]),
    ),
  ];
  const config: WikiPublishConfig = {
    appId,
    owner,
    privateKey: Redacted.make(privateKey),
    repository,
  };
  return { calls, config, handlers };
});

export { baseCommit, baseTree, createdCommit, createdTree, fakeGitHub, pullRequestUrl };

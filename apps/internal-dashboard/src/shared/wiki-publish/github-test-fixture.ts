import { gitHubApiOrigin, httpStatus } from "@repo/config";
import { gitHubAppKeyFixture } from "@repo/config/testing";
import { Effect, Redacted } from "effect";
import { HttpResponse, http } from "msw";

import type { WikiPublishConfig } from "@repo/config";
import type { HttpResponseResolver, JsonBodyType } from "msw";

type GitHubCall = Readonly<{ body: unknown; path: string }>;
type Resolved = Parameters<HttpResponseResolver>[0];
type GitHubRequest = Resolved["request"];

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
const repositoryApi = `${gitHubApiOrigin}/repos/${owner}/${repository}`;

const byInstallation = (request: GitHubRequest): boolean =>
  request.headers.get("authorization") === `Bearer ${installationToken}` &&
  request.headers.get("user-agent") !== null;

const refused = (): Response =>
  HttpResponse.json({ message: "Bad credentials" }, { status: httpStatus.unauthorized });

type FakeGitHubOptions = Readonly<{
  keyFormat?: "pkcs1" | "pkcs8";
  unavailableStep?: string;
}>;

const fakeGitHub = Effect.fn("fakeGitHub")(function* fakeGitHub(
  publishedBlob: string | null,
  { keyFormat = "pkcs8", unavailableStep }: FakeGitHubOptions = {},
) {
  const key = yield* gitHubAppKeyFixture(keyFormat);
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
      key
        .signedBy(request.headers.get("authorization"), appId)
        .then((signed) => (signed ? HttpResponse.json({ id: installationId }) : refused())),
    ),
    http.post(
      `${gitHubApiOrigin}/app/installations/${String(installationId)}/access_tokens`,
      ({ request }) =>
        key
          .signedBy(request.headers.get("authorization"), appId)
          .then((signed) =>
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
    privateKey: Redacted.make(key.privateKey),
    repository,
  };
  return { calls, config, handlers };
});

export { baseCommit, baseTree, createdCommit, createdTree, fakeGitHub, pullRequestUrl };

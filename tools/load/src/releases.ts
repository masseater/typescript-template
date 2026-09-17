interface Release {
  readonly archive: string;
  readonly digest: string;
  readonly member: string;
}

const version = "2.2.0";

function release(platform: string, archive: string, digest: string): readonly [string, Release] {
  return [
    platform,
    {
      archive: `k6-v${version}-${archive}`,
      digest,
      member: `k6-v${version}-${archive.split(".")[0] ?? ""}/k6`,
    },
  ];
}

const releases: ReadonlyMap<string, Release> = new Map([
  release(
    "darwin-arm64",
    "macos-arm64.zip",
    "37a028506bf13578de66c906296803775df28cc2504b1a8c5d786b2803e757c7",
  ),
  release(
    "darwin-x64",
    "macos-amd64.zip",
    "45a08590511c8a6a9c6331645e60c41624924e848e29472e87c60ac956d50372",
  ),
  release(
    "linux-arm64",
    "linux-arm64.tar.gz",
    "4ecd64cadcc792402d16293836115480419c4447c032858f564852d98f1bf54c",
  ),
  release(
    "linux-x64",
    "linux-amd64.tar.gz",
    "b5a8003c86f35f5cd5ceef1490312c48e587696c94d998cefc6d7b3b4cb1597d",
  ),
]);

const downloadOrigin = "https://github.com/grafana/k6/releases/download";

function downloadUrl(archive: string): string {
  return `${downloadOrigin}/v${version}/${archive}`;
}

export { downloadUrl, releases, version };
export type { Release };

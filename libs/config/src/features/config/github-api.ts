import { Duration, Schema } from "effect";

const gitHubApiOrigin = "https://api.github.com";
const gitHubRequestTimeout = Duration.seconds(10);
const gitHubSuccessStatus = { first: 200, last: 299 } as const;

const GitHubInstallation = Schema.Struct({ id: Schema.Finite });

export { GitHubInstallation, gitHubApiOrigin, gitHubRequestTimeout, gitHubSuccessStatus };

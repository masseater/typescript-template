import type { RepositoryProblem } from "@repo/dont-review-it/repository-checks";

export type { RepositoryProblem } from "@repo/dont-review-it/repository-checks";

export const formatRepositoryProblem = ({ file, line, message }: RepositoryProblem): string =>
  line === null ? `${file} ${message}` : `${file}:${line} ${message}`;

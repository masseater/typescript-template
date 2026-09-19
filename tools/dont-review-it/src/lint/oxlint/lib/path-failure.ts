import { failureCodeOf } from "@repo/dont-review-it/repository-checks";

export const isEnvironmentFailure = (failure: unknown): boolean => failureCodeOf(failure) !== null;

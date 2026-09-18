import { failureCodeOf } from "@repo/repository-checks";

export const isEnvironmentFailure = (failure: unknown): boolean => failureCodeOf(failure) !== null;

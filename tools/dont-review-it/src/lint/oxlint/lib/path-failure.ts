import { failureCodeOf } from "@template/repository-checks";

export const isEnvironmentFailure = (failure: unknown): boolean => failureCodeOf(failure) !== null;

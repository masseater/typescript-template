import { failureCodeOf } from "../../../platform/path-failure.ts";

export const isEnvironmentFailure = (failure: unknown): boolean => failureCodeOf(failure) !== null;

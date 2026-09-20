import { failureCodeOf } from "../../../repository-checks/index.ts";

export const isEnvironmentFailure = (failure: unknown): boolean => failureCodeOf(failure) !== null;

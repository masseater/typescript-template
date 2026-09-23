import { optionalSetting } from "@repo/config/process-environment";

const ENABLE_VARIABLE = "MST_TELEMETRY";

const telemetryAsked: boolean = optionalSetting(ENABLE_VARIABLE) !== undefined;

export { ENABLE_VARIABLE, telemetryAsked };

import {
  processSetting,
  telemetryEnableVariable,
  telemetrySettings,
} from "@repo/config/process-environment";

const ENABLE_VARIABLE = telemetryEnableVariable;

const telemetryMeasured: boolean = processSetting(telemetrySettings).measured;

export { ENABLE_VARIABLE, telemetryMeasured };

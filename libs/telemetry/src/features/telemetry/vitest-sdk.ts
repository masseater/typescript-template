import { startTelemetry, type Telemetry } from "./telemetry.ts";

const vitestSdk: Pick<Telemetry, "shutdown"> = { shutdown: startTelemetry("mst-test").shutdown };

export default vitestSdk;

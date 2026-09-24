import { sdkFilePath } from "@repo/telemetry/vitest-sdk-path";

const vitestSdkPath: string = sdkFilePath(
  import.meta.resolve("@repo/ai-native-telemetry/vitest-sdk"),
);

export { vitestSdkPath };

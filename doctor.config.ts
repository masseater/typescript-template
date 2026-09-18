import { defineConfig } from "react-doctor/api";

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  blocking: "warning",
  ignore: { files: ["dist/**"] },
  projects: ["*"],
  share: false,
  supplyChain: { enabled: false },
});

import { defineConfig } from "react-doctor/api";

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  blocking: "warning",
  ignore: { files: ["dist/**"] },
  noScore: true,
  projects: ["*"],
  respectInlineDisables: false,
  share: false,
  supplyChain: { enabled: false },
});

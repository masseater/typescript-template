import fsd from "@feature-sliced/steiger-plugin";
import { defineConfig } from "steiger";

// oxlint-disable-next-line import/no-default-export
export default defineConfig([
  // oxlint-disable-next-line typescript/no-unsafe-assignment
  ...fsd.configs.recommended,
]);

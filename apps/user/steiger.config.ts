import { defineConfig } from "steiger";
import fsd from "@feature-sliced/steiger-plugin";

// oxlint-disable-next-line import/no-default-export
export default defineConfig([
  // oxlint-disable-next-line typescript/no-unsafe-assignment
  ...fsd.configs.recommended,
]);

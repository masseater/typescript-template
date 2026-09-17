// oxlint-disable-next-line import/no-unassigned-import
import "@template/ui/styles.css";
import a11y from "@storybook/addon-a11y";
import { definePreview } from "@storybook/react-vite";
import msw from "msw-storybook-addon";
import vitest from "@storybook/addon-vitest";

const preview = definePreview({
  addons: [a11y(), vitest(), msw()],
  parameters: { a11y: { test: "error" }, layout: "padded" },
  tags: ["test"],
});

// oxlint-disable-next-line import/no-default-export
export default preview;

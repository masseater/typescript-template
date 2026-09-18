import preview from "../.storybook/preview";
import { BackupCodeList } from "./backup-code-list";

const meta = preview.meta({ component: BackupCodeList });

export const Default = meta.story({
  args: { codes: ["4f2a-91bc", "7d10-5e33", "a8c4-2b70", "ee91-6d45", "1b77-c082"] },
});

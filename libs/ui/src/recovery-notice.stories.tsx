import preview from "../storybook/preview";
import { RecoveryNotice } from "./recovery-notice";

const meta = preview.meta({ component: RecoveryNotice });

export const None = meta.story({ args: { recovery: undefined, role: "user" } });

export const Setup = meta.story({ args: { recovery: "setup", role: "user" } });

export const RecoveredUser = meta.story({ args: { recovery: "1", role: "user" } });

export const RecoveredAdmin = meta.story({ args: { recovery: "1", role: "admin" } });

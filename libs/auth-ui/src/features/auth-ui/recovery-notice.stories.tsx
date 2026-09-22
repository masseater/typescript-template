import preview from "../../../storybook/preview";
import { RecoveryNotice } from "./recovery-notice";

const meta = preview.meta({ component: RecoveryNotice });

export const None = meta.story({ args: { recovery: undefined, role: "member" } });

export const Setup = meta.story({ args: { recovery: "setup", role: "member" } });

export const RecoveredUser = meta.story({ args: { recovery: "1", role: "member" } });

export const RecoveredAdmin = meta.story({ args: { recovery: "1", role: "admin" } });

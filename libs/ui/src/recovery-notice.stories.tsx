import { RecoveryNotice } from "./recovery-notice";
import preview from "../.storybook/preview";

const meta = preview.meta({ component: RecoveryNotice });

const None = meta.story({ args: { recovery: undefined, role: "user" } });

const Setup = meta.story({ args: { recovery: "setup", role: "user" } });

const RecoveredUser = meta.story({ args: { recovery: "1", role: "user" } });

const RecoveredAdmin = meta.story({ args: { recovery: "1", role: "admin" } });

export { None, RecoveredAdmin, RecoveredUser, Setup };

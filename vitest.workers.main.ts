import { probeHandler } from "./libs/monitor/src/monitor-fixture.ts";

export {
  MailRecorder,
  ProbeMonitor,
  probeAlert,
  probeEvent,
  probeFailure,
  probeHandler,
} from "./libs/monitor/src/monitor-fixture.ts";
export type { Outcome, SentMail } from "./libs/monitor/src/monitor-fixture.ts";
export { UserInbox } from "./libs/user-inbox/src/inbox.ts";

export default probeHandler;

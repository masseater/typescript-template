import { httpStatus } from "@repo/observability";
import { unavailable } from "@repo/runtime/account";

const memberFailures = {
  ...unavailable,
  UserNotFound: { message: "対象が見つかりません。", status: httpStatus.notFound },
} as const;

export { memberFailures };

import { httpStatus } from "@repo/observability";
import { sessionFailures } from "@repo/runtime/account";

const memberFailures = {
  ...sessionFailures,
  UserNotFound: { message: "対象が見つかりません。", status: httpStatus.notFound },
} as const;

export { memberFailures };

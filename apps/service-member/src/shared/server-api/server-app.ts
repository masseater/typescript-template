import { accountApi } from "@repo/runtime/account";
import { apiRoot, apiRoutes, createApi } from "@repo/runtime/http";

import { billingApi } from "./billing-api.ts";
import { boardApi } from "./board-api.ts";
import { contactApi } from "./contact-api.ts";
import { flagsApi } from "./flags-api.ts";
import { interviewApi } from "./interview-api.ts";
import { membersApi } from "./members-api.ts";
import { reporting, runtime } from "./runtime.ts";
import { socialApi } from "./social-api.ts";

const api = apiRoutes(runtime, reporting);

const userApi = createApi(apiRoot)
  .use(accountApi(api))
  .use(billingApi(api))
  .use(contactApi(api))
  .use(flagsApi(api))
  .use(interviewApi(api))
  .use(membersApi(api))
  .use(socialApi(api))
  .use(boardApi(api));

export { userApi };

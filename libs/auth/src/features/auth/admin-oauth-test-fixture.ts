import { APPLICATION, ROLE } from "@repo/config";
import { ADMIN_PERMISSION, type AdminPermission } from "@repo/config/identity";
import { Effect } from "effect";

import {
  assignAdminPermissionByEmail,
  assignRoleByEmail,
  bootstrapVerifiedAdmin,
  enableTotp,
  registerVerified,
  signInAs,
} from "./auth-test-fixture.ts";
import { origins } from "./browser-client-test-fixture.ts";
import { startClientAuthorization } from "./oauth-client-test-fixture.ts";

const adminOrigin = origins[APPLICATION.serviceAdmin];
const adminRedirectUri = "http://127.0.0.1:43124/callback";

const adminOperator = Effect.fn("adminOperator")(function* adminOperator(
  email: string,
  permission: AdminPermission = ADMIN_PERMISSION.operator,
) {
  yield* bootstrapVerifiedAdmin("keeper@example.com");
  yield* registerVerified(email);
  yield* assignRoleByEmail(email, ROLE.admin);
  if (permission !== ADMIN_PERMISSION.owner) {
    yield* assignAdminPermissionByEmail(email, permission);
  }
  const client = yield* signInAs(APPLICATION.serviceAdmin, email);
  yield* enableTotp(client);
  return client;
});

const startAdminAuthorization = Effect.fn("startAdminAuthorization")(
  function* startAdminAuthorization() {
    return yield* startClientAuthorization({
      application: APPLICATION.serviceAdmin,
      clientName: "Test admin MCP client",
      redirectUri: adminRedirectUri,
      scope: "admin:read offline_access",
    });
  },
);

export { adminOperator, adminOrigin, adminRedirectUri, startAdminAuthorization };

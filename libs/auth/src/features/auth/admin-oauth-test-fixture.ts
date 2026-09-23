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
import { startOAuthAuthorization } from "./oauth-authorization-test-fixture.ts";

const adminOrigin = origins[APPLICATION.admin];

const adminOperator = Effect.fn("adminOperator")(function* adminOperator(
  email: string,
  permission: AdminPermission = ADMIN_PERMISSION.operator,
) {
  yield* bootstrapVerifiedAdmin("keeper@example.com");
  yield* registerVerified(email);
  yield* assignRoleByEmail(email, ROLE.administrator);
  if (permission !== ADMIN_PERMISSION.owner) {
    yield* assignAdminPermissionByEmail(email, permission);
  }
  const client = yield* signInAs(APPLICATION.admin, email);
  yield* enableTotp(client);
  return client;
});

const startAuthorization = () =>
  startOAuthAuthorization({
    application: APPLICATION.admin,
    clientName: "Test admin MCP client",
    redirectUri: "http://127.0.0.1:43124/callback",
    scope: "admin:read offline_access",
  });

export { adminOperator, adminOrigin, startAuthorization };

import { createFileRoute } from "@tanstack/react-router";
import { deleteUser, listUsers, setUserRole } from "@template/db/admin";
import { apiResponse, readJson } from "@template/runtime/http";
import * as v from "valibot";

export const Route = createFileRoute("/api/users")({
  server: {
    handlers: {
      GET: ({ request, context }) =>
        apiResponse(async () => {
          const { session } = await context.runtime.session(request);
          const search = new URL(request.url).searchParams;
          const input = {
            limit: Number(search.get("limit") ?? 50),
            offset: Number(search.get("offset") ?? 0),
          };
          return listUsers(context.runtime.database, session.id, input);
        }, context.runtime.reportError),
      PATCH: ({ request, context }) =>
        apiResponse(async () => {
          const { session } = await context.runtime.session(request);
          const input = v.parse(
            v.strictObject({
              id: v.pipe(v.string(), v.minLength(1)),
              role: v.picklist(["user", "admin"]),
            }),
            await readJson(request, context.runtime.config.APP_ORIGIN),
          );
          return setUserRole(context.runtime.database, session.id, input.id, input.role);
        }, context.runtime.reportError),
      DELETE: ({ request, context }) =>
        apiResponse(async () => {
          const { session } = await context.runtime.session(request);
          const input = v.parse(
            v.strictObject({ id: v.pipe(v.string(), v.minLength(1)) }),
            await readJson(request, context.runtime.config.APP_ORIGIN),
          );
          return deleteUser(context.runtime.database, session.id, input.id);
        }, context.runtime.reportError),
    },
  },
});

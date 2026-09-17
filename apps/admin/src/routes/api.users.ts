import { apiResponse, readJson } from "@template/runtime/http";
import { deleteUser, listUsers, setUserRole } from "@template/db/admin";
import { minLength, parse, picklist, pipe, strictObject, string } from "valibot";
import { createFileRoute } from "@tanstack/react-router";
import { usersPageSize } from "#users-pagination.ts";

const userIdSchema = pipe(string(), minLength(1));
const deleteUserSchema = strictObject({ id: userIdSchema });
const setUserRoleSchema = strictObject({ id: userIdSchema, role: picklist(["user", "admin"]) });

export const Route = createFileRoute("/api/users")({
  server: {
    handlers: {
      DELETE: async ({ request, context }) =>
        apiResponse(async () => {
          const { session } = await context.runtime.session(request);
          const body = await readJson(request, context.runtime.config.APP_ORIGIN);
          const input = parse(deleteUserSchema, body);
          return deleteUser(context.runtime.database, session.id, input.id);
        }, context.runtime.reportError),
      GET: async ({ request, context }) =>
        apiResponse(async () => {
          const { session } = await context.runtime.session(request);
          const search = new URL(request.url).searchParams;
          const input = {
            limit: Number(search.get("limit") ?? usersPageSize),
            offset: Number(search.get("offset") ?? 0),
          };
          return listUsers(context.runtime.database, session.id, input);
        }, context.runtime.reportError),
      PATCH: async ({ request, context }) =>
        apiResponse(async () => {
          const { session } = await context.runtime.session(request);
          const body = await readJson(request, context.runtime.config.APP_ORIGIN);
          const input = parse(setUserRoleSchema, body);
          return setUserRole({
            database: context.runtime.database,
            role: input.role,
            sessionId: session.id,
            targetId: input.id,
          });
        }, context.runtime.reportError),
    },
  },
});

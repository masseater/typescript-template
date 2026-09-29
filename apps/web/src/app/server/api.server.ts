import { todoRoutes } from "#/entities/todo/index.server";
import { createRouter } from "#/shared/api/index.server";
import { auth } from "#/shared/auth/index.server";

export const api = createRouter("").mount(auth.handler).use(todoRoutes);

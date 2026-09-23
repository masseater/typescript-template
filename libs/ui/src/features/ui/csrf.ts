import { createCsrfMiddleware } from "@tanstack/react-start";

const serverFunctionCsrf = createCsrfMiddleware({
  filter: (handled) => handled.handlerType === "serverFn",
});

export { serverFunctionCsrf };

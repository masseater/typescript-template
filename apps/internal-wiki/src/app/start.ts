import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

const csrf = createCsrfMiddleware({
  filter: (context) => context.handlerType === "serverFn",
});

const startInstance = createStart(() => ({ requestMiddleware: [csrf] }));

export { startInstance };

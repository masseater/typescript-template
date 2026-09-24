import { serverFunctionCsrf } from "@repo/ui/shell";
import { createStart } from "@tanstack/react-start";

const startInstance = createStart(() => ({ requestMiddleware: [serverFunctionCsrf] }));

export { startInstance };

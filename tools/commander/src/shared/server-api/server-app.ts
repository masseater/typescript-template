import { commanderApp } from "./commander-api.ts";
import { runtime } from "./runtime.ts";
import { reporting } from "./services.ts";

const api = commanderApp(runtime, reporting);

export { api };

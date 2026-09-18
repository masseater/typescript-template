import { commanderApp } from "./commander-api.ts";
import { runtime } from "./runtime.ts";

const api = commanderApp(runtime);

export { api };

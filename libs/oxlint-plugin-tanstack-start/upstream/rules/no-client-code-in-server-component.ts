import { Option, Record } from "effect";
import plugin from "oxlint-plugin-tanstack-start";

const name = "no-client-code-in-server-component";

const rule = Record.get(plugin.rules, name).pipe(
  Option.getOrThrowWith(() => new Error(`rule ${name} is missing`)),
);

export { name, rule };

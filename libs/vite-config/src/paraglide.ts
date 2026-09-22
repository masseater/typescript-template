import { paraglideVitePlugin } from "@inlang/paraglide-js";

import { paraglideCompileOptions, paraglideStrategy } from "./paraglide-options.ts";

import type { PluginOption } from "vite-plus";

const paraglideAppPlugin = (): PluginOption => paraglideVitePlugin(paraglideCompileOptions);

export { paraglideAppPlugin, paraglideCompileOptions, paraglideStrategy };

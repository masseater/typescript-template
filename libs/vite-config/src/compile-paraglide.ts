#!/usr/bin/env node
import { compile } from "@inlang/paraglide-js";

import { paraglideCompileOptions } from "./paraglide-options.ts";

await compile(paraglideCompileOptions);

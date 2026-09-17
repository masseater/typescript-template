import * as pulumi from "@pulumi/pulumi";
import { parseSharedConfig, validateAuthSecret } from "./config.ts";

const config = new pulumi.Config();
export const applicationSettings = parseSharedConfig(config.requireObject<unknown>("settings"));
export const authSecret = config.requireSecret("authSecret").apply(validateAuthSecret);

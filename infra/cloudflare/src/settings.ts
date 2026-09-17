import { parseSharedConfig, validateAuthSecret } from "./config.ts";
import { Config } from "@pulumi/pulumi";

const config = new Config();
const applicationSettings = parseSharedConfig(config.requireObject<unknown>("settings"));
const authSecret = config.requireSecret("authSecret").apply(validateAuthSecret);

export { applicationSettings, authSecret };

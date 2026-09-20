import { Schema } from "effect";

/** @canonical-values config.application */
export const applications = ["service-member", "service-admin", "internal-dashboard"] as const;
export const APPLICATION = {
  user: applications[0],
  admin: applications[1],
  wiki: applications[2],
} as const;

export const ApplicationName = Schema.Literals(applications);
export type Application = (typeof applications)[number];
export type ServiceName = Application | "commander";

const SERVICE_MEMBER_PORT = 3001;
const SERVICE_ADMIN_PORT = 3002;
const INTERNAL_DASHBOARD_PORT = 3003;
export const applicationPorts: Readonly<Record<Application, number>> = {
  "internal-dashboard": INTERNAL_DASHBOARD_PORT,
  "service-admin": SERVICE_ADMIN_PORT,
  "service-member": SERVICE_MEMBER_PORT,
};
export const applicationReadyPaths: Readonly<Record<Application, string>> = {
  "internal-dashboard": "/login",
  "service-admin": "/login",
  "service-member": "/login",
};

const capabilities = ["ai"] as const;
export type Capability = (typeof capabilities)[number];
const applicationCapabilities = {
  "internal-dashboard": ["ai"],
  "service-admin": [],
  "service-member": ["ai"],
} as const satisfies Readonly<Record<Application, readonly Capability[]>>;

export type CapabilityOf<App extends Application> = (typeof applicationCapabilities)[App][number];

export const grants = (app: Application, capability: Capability): boolean => {
  const granted: readonly Capability[] = applicationCapabilities[app];
  return granted.includes(capability);
};

export const loopbackAddress = "127.0.0.1";
export const loopbackHosts: readonly string[] = ["localhost", loopbackAddress, "[::1]"];
export const loopbackHostSet: ReadonlySet<string> = new Set(loopbackHosts);

export const loopbackOrigin = (listeningPort: number): string =>
  `http://${loopbackAddress}:${listeningPort}`;

export const applicationOrigins: Readonly<Record<Application, string>> = {
  "internal-dashboard": loopbackOrigin(INTERNAL_DASHBOARD_PORT),
  "service-admin": loopbackOrigin(SERVICE_ADMIN_PORT),
  "service-member": loopbackOrigin(SERVICE_MEMBER_PORT),
};

const STORYBOOK_PORT = 3051;
export const storybookPort = STORYBOOK_PORT;
export const storybookOrigin = `http://localhost:${STORYBOOK_PORT}`;

const MAILPIT_PORT = 8025;
export const mailpitPort = MAILPIT_PORT;
export const mailpitOrigin = loopbackOrigin(MAILPIT_PORT);

export const scalarReferencePath = "/assets/scalar-api-reference.js";

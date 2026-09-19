import { Schema } from "effect";

const SERVICE_MEMBER_PORT = 3001;
const SERVICE_ADMIN_PORT = 3002;
const INTERNAL_DASHBOARD_PORT = 3003;
const STORYBOOK_PORT = 3051;
const MAILPIT_PORT = 8025;

const applications = ["service-member", "service-admin", "internal-dashboard"] as const;
const ApplicationName = Schema.Literals(applications);
type Application = (typeof applications)[number];
const applicationPorts: Readonly<Record<Application, number>> = {
  "internal-dashboard": INTERNAL_DASHBOARD_PORT,
  "service-admin": SERVICE_ADMIN_PORT,
  "service-member": SERVICE_MEMBER_PORT,
};
const applicationReadyPaths: Readonly<Record<Application, string>> = {
  "internal-dashboard": "/login",
  "service-admin": "/login",
  "service-member": "/login",
};
const capabilities = ["ai"] as const;
type Capability = (typeof capabilities)[number];
const applicationCapabilities = {
  "internal-dashboard": ["ai"],
  "service-admin": [],
  "service-member": ["ai"],
} as const satisfies Readonly<Record<Application, readonly Capability[]>>;

type CapabilityOf<App extends Application> = (typeof applicationCapabilities)[App][number];

function grants(app: Application, capability: Capability): boolean {
  const granted: readonly Capability[] = applicationCapabilities[app];
  return granted.includes(capability);
}

const loopbackAddress = "127.0.0.1";
const loopbackHosts: readonly string[] = ["localhost", loopbackAddress, "[::1]"];
const storybookPort = STORYBOOK_PORT;
const mailpitPort = MAILPIT_PORT;

function loopbackOrigin(port: number): string {
  return `http://${loopbackAddress}:${port}`;
}

const applicationOrigins: Readonly<Record<Application, string>> = {
  "internal-dashboard": loopbackOrigin(INTERNAL_DASHBOARD_PORT),
  "service-admin": loopbackOrigin(SERVICE_ADMIN_PORT),
  "service-member": loopbackOrigin(SERVICE_MEMBER_PORT),
};
const mailpitOrigin = loopbackOrigin(MAILPIT_PORT);
const storybookOrigin = `http://localhost:${STORYBOOK_PORT}`;

export {
  ApplicationName,
  applicationOrigins,
  applicationPorts,
  applicationReadyPaths,
  applications,
  grants,
  loopbackAddress,
  loopbackHosts,
  loopbackOrigin,
  mailpitOrigin,
  mailpitPort,
  storybookOrigin,
  storybookPort,
};
export type { Application, Capability, CapabilityOf };

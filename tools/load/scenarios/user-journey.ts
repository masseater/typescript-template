import { check, fail, group, sleep } from "k6";
import type { Options } from "k6/options";
import type { Params } from "k6/http";
import exec from "k6/execution";
import http from "k6/http";

const ok = 200;
const mailAttempts = 20;
const mailWaitSeconds = 0.5;
const password = "Load-Test-Passw0rd!";
const keyword = encodeURIComponent("負荷");

const target = __ENV["LOAD_TARGET_ORIGIN"] ?? "";
const memberPageSize = Number(__ENV["LOAD_MEMBER_PAGE_SIZE"] ?? "0");
const peakUsers = Number(__ENV["LOAD_PEAK_USERS"] ?? "0");
const rampSeconds = __ENV["LOAD_RAMP"] ?? "0s";
const holdSeconds = __ENV["LOAD_HOLD"] ?? "0s";
const mail = __ENV["LOAD_MAILPIT_ORIGIN"] ?? "";

const options: Options = {
  scenarios: {
    journey: {
      executor: "ramping-vus",
      stages: [
        { duration: rampSeconds, target: peakUsers },
        { duration: holdSeconds, target: peakUsers },
        { duration: rampSeconds, target: 0 },
      ],
      startVUs: 0,
    },
  },
  thresholds: {
    checks: ["rate==1"],
    "http_req_duration{name:login-page}": ["p(95)<1000"],
    "http_req_duration{name:member-page}": ["p(95)<1000"],
    "http_req_duration{name:members-search}": ["p(95)<1000"],
    "http_req_duration{name:members}": ["p(95)<1000"],
    "http_req_duration{name:profile}": ["p(95)<1000"],
    "http_req_duration{name:session}": ["p(95)<1000"],
    "http_req_duration{name:users-page}": ["p(95)<1000"],
    http_req_failed: ["rate<0.01"],
  },
};

interface Session {
  readonly cookies: Readonly<Record<string, string>>;
  readonly id: string;
}

const jar = new http.CookieJar();
const anonymous = new http.CookieJar();

const documentationRange = "203.0.113.";
const hosts = 254;

function client(): Readonly<Record<string, string>> {
  return { "cf-connecting-ip": `${documentationRange}${1 + (exec.vu.idInTest % hosts)}` };
}

function json(): Readonly<Record<string, string>> {
  return { ...client(), "content-type": "application/json", origin: target };
}

function read(name: string): Params {
  return { headers: client(), jar, tags: { name } };
}

const tokenMarker = "#token=";

function tokenIn(body: unknown): string | undefined {
  const start = typeof body === "string" ? body.indexOf(tokenMarker) : -1;
  return typeof body === "string" && start >= 0
    ? body.slice(start + tokenMarker.length).split(/\s/u)[0]
    : undefined;
}

function verificationToken(email: string): string {
  for (let attempt = 0; attempt < mailAttempts; attempt += 1) {
    const query = encodeURIComponent(`to:${email}`);
    const id = http.get(`${mail}/api/v1/search?query=${query}`).json("messages.0.ID");
    const token =
      typeof id === "string" ? tokenIn(http.get(`${mail}/api/v1/message/${id}`).json("Text")) : "";
    if (token !== undefined && token !== "") {
      return token;
    }
    sleep(mailWaitSeconds);
  }
  return fail(`no verification mail arrived for ${email}`);
}

function register(email: string): void {
  const signUp = http.post(
    `${target}/api/auth/sign-up/email`,
    JSON.stringify({ email, name: "負荷試験の利用者", password }),
    { headers: json() },
  );
  if (signUp.status !== ok) {
    fail(`sign-up answered ${signUp.status}`);
  }
  const verified = http.post(
    `${target}/api/verify-email`,
    JSON.stringify({ token: verificationToken(email) }),
    { headers: json() },
  );
  if (verified.status !== ok) {
    fail(`verify-email answered ${verified.status}`);
  }
}

function setCookies(response: {
  readonly cookies: Readonly<Record<string, readonly { readonly value: string }[]>>;
}): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const [name, values] of Object.entries(response.cookies)) {
    const value = values[0]?.value;
    if (value !== undefined) {
      cookies[name] = value;
    }
  }
  return cookies;
}

function signIn(email: string): Session {
  const response = http.post(
    `${target}/api/auth/sign-in/email`,
    JSON.stringify({ email, password }),
    { headers: json() },
  );
  if (response.status !== ok) {
    fail(`sign-in answered ${response.status}`);
  }
  const found = response.json("user.id");
  const id = typeof found === "string" ? found : fail("sign-in answered without a user id");
  return { cookies: setCookies(response), id };
}

function setup(): Session {
  const email = `load-${Date.now()}@example.test`;
  register(email);
  return signIn(email);
}

function readSession(): void {
  const response = http.get(`${target}/api/session`, read("session"));
  const { status } = response;
  const named = typeof response.json("user.id") === "string";
  check(response, {
    "session answers 200": () => status === ok,
    "session names the signed-in user": () => named,
  });
}

function readProfile(): void {
  const response = http.get(`${target}/api/profile`, read("profile"));
  const { status } = response;
  const editable =
    typeof response.json("name") === "string" && typeof response.json("profile") === "string";
  check(response, {
    "profile answers 200": () => status === ok,
    "profile carries the editable fields": () => editable,
  });
}

function readMembers(): void {
  const response = http.get(`${target}/api/members?page=1`, read("members"));
  const { status } = response;
  const paged = response.json("pageSize") === memberPageSize;
  check(response, {
    "member list answers 200": () => status === ok,
    "member list serves the page size the screen draws": () => paged,
  });
}

function searchMembers(): void {
  const response = http.get(
    `${target}/api/members?keyword=${keyword}&page=1`,
    read("members-search"),
  );
  const { status } = response;
  const counted = typeof response.json("total") === "number";
  check(response, {
    "member search answers 200": () => status === ok,
    "member search counts its matches": () => counted,
  });
}

function readLoginPage(): void {
  const response = http.get(`${target}/login`, {
    headers: client(),
    jar: anonymous,
    redirects: 0,
    tags: { name: "login-page" },
  });
  const { status } = response;
  check(response, { "login page answers 200 to a visitor": () => status === ok });
}

function readMemberDirectory(): void {
  const response = http.get(`${target}/users`, { ...read("users-page"), redirects: 0 });
  const { status } = response;
  check(response, { "member directory answers 200": () => status === ok });
}

function readMemberHome(id: string): void {
  const response = http.get(`${target}/users/${id}`, { ...read("member-page"), redirects: 0 });
  const { status } = response;
  check(response, { "member home answers 200": () => status === ok });
}

function memberApis(): void {
  readSession();
  readProfile();
  readMembers();
  searchMembers();
}

let restored = false;

function journey(session: Session): void {
  if (!restored) {
    for (const [name, value] of Object.entries(session.cookies)) {
      jar.set(target, name, value);
    }
    restored = true;
  }
  group("public", readLoginPage);
  group("member screens", () => {
    readMemberDirectory();
    readMemberHome(session.id);
  });
  group("member api", memberApis);
}

// oxlint-disable-next-line import/no-default-export
export default journey;
export { options, setup };

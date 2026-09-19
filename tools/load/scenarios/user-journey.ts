import { check, fail, group, sleep } from "k6";
import exec from "k6/execution";
import http, { type Params } from "k6/http";

import type { Options } from "k6/options";

const ok = 200;
const mailAttempts = 20;
const mailWaitSeconds = 0.5;
const password = "Load-Test-Passw0rd!";
const keyword = encodeURIComponent("負荷");

const targetOrigin = __ENV.LOAD_TARGET_ORIGIN ?? "";
const memberPageSize = Number(__ENV.LOAD_MEMBER_PAGE_SIZE ?? "0");
const peakUsers = Number(__ENV.LOAD_PEAK_USERS ?? "0");

const rampSeconds = __ENV.LOAD_RAMP ?? "0s";

const holdSeconds = __ENV.LOAD_HOLD ?? "0s";

const loadOptions: Options = {
  scenarios: {
    journey: {
      exec: "journey",
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

const tokenMarker = "#token=";

const tokenIn = (mailText: unknown): string | undefined => {
  const start = typeof mailText === "string" ? mailText.indexOf(tokenMarker) : -1;
  return typeof mailText === "string" && start >= 0
    ? mailText.slice(start + tokenMarker.length).split(/\s/u)[0]
    : undefined;
};

const mail = __ENV.LOAD_MAILPIT_ORIGIN ?? "";

const verificationToken = (email: string, attempt = 0): string => {
  if (attempt >= mailAttempts) {
    return fail(`no verification mail arrived for ${email}`);
  }
  const query = encodeURIComponent(`to:${email}`);
  const messageId = http.get(`${mail}/api/v1/search?query=${query}`).json("messages.0.ID");
  const token =
    typeof messageId === "string"
      ? tokenIn(http.get(`${mail}/api/v1/message/${messageId}`).json("Text"))
      : "";
  if (token !== undefined && token !== "") {
    return token;
  }
  sleep(mailWaitSeconds);
  return verificationToken(email, attempt + 1);
};

const documentationRange = "203.0.113.";

const hosts = 254;

const client = (): Readonly<Record<string, string>> => {
  return { "cf-connecting-ip": `${documentationRange}${1 + (exec.vu.idInTest % hosts)}` };
};

const json = (): Readonly<Record<string, string>> => {
  return { ...client(), "content-type": "application/json", origin: targetOrigin };
};

const register = (email: string): void => {
  const signUp = http.post(
    `${targetOrigin}/api/auth/sign-up/email`,
    JSON.stringify({ email, name: "負荷試験の利用者", password }),
    { headers: json() },
  );
  if (signUp.status !== ok) {
    fail(`sign-up answered ${signUp.status}`);
  }
  const verified = http.post(
    `${targetOrigin}/api/verify-email`,
    JSON.stringify({ token: verificationToken(email) }),
    { headers: json() },
  );
  if (verified.status !== ok) {
    fail(`verify-email answered ${verified.status}`);
  }
};

const setCookies = (answered: {
  readonly cookies: Readonly<Record<string, readonly { readonly value: string }[]>>;
}): Readonly<Record<string, string>> => {
  return Object.fromEntries(
    Object.entries(answered.cookies).flatMap(([cookieName, cookieValues]) => {
      const carried = cookieValues[0]?.value;
      return carried === undefined ? [] : [[cookieName, carried] as const];
    }),
  );
};

type Session = {
  readonly cookies: Readonly<Record<string, string>>;
  readonly id: string;
};

const signIn = (email: string): Session => {
  const answered = http.post(
    `${targetOrigin}/api/auth/sign-in/email`,
    JSON.stringify({ email, password }),
    { headers: json() },
  );
  if (answered.status !== ok) {
    fail(`sign-in answered ${answered.status}`);
  }
  const found = answered.json("user.id");
  const memberId = typeof found === "string" ? found : fail("sign-in answered without a user id");
  return { cookies: setCookies(answered), id: memberId };
};

const setup = (): Session => {
  const email = `load-${Date.now()}@example.test`;
  register(email);
  return signIn(email);
};

const anonymous = new http.CookieJar();

const readLoginPage = (): void => {
  const answered = http.get(`${targetOrigin}/login`, {
    headers: client(),
    jar: anonymous,
    redirects: 0,
    tags: { name: "login-page" },
  });
  const { status } = answered;
  check(answered, { "login page answers 200 to a visitor": () => status === ok });
};

const jar = new http.CookieJar();

const read = (tagName: string): Params => {
  return { headers: client(), jar, tags: { name: tagName } };
};

const readMemberDirectory = (): void => {
  const answered = http.get(`${targetOrigin}/users`, { ...read("users-page"), redirects: 0 });
  const { status } = answered;
  check(answered, { "member directory answers 200": () => status === ok });
};

const readMemberHome = (memberId: string): void => {
  const answered = http.get(`${targetOrigin}/users/${memberId}`, {
    ...read("member-page"),
    redirects: 0,
  });
  const { status } = answered;
  check(answered, { "member home answers 200": () => status === ok });
};

const readSession = (): void => {
  const answered = http.get(`${targetOrigin}/api/session`, read("session"));
  const { status } = answered;
  const named = typeof answered.json("user.id") === "string";
  check(answered, {
    "session answers 200": () => status === ok,
    "session names the signed-in user": () => named,
  });
};

const readProfile = (): void => {
  const answered = http.get(`${targetOrigin}/api/profile`, read("profile"));
  const { status } = answered;
  const editable =
    typeof answered.json("name") === "string" && typeof answered.json("profile") === "string";
  check(answered, {
    "profile answers 200": () => status === ok,
    "profile carries the editable fields": () => editable,
  });
};

const readMembers = (): void => {
  const answered = http.get(`${targetOrigin}/api/members?page=1`, read("members"));
  const { status } = answered;
  const paged = answered.json("pageSize") === memberPageSize;
  check(answered, {
    "member list answers 200": () => status === ok,
    "member list serves the page size the screen draws": () => paged,
  });
};

const searchMembers = (): void => {
  const answered = http.get(
    `${targetOrigin}/api/members?keyword=${keyword}&page=1`,
    read("members-search"),
  );
  const { status } = answered;
  const counted = typeof answered.json("total") === "number";
  check(answered, {
    "member search answers 200": () => status === ok,
    "member search counts its matches": () => counted,
  });
};

const memberApis = (): void => {
  readSession();
  readProfile();
  readMembers();
  searchMembers();
};

const firstIteration = 0;

const journey = (session: Session): void => {
  if (exec.vu.iterationInInstance === firstIteration) {
    Object.entries(session.cookies).forEach(([cookieName, cookieValue]) => {
      jar.set(targetOrigin, cookieName, cookieValue);
    });
  }
  group("public", readLoginPage);
  group("member screens", () => {
    readMemberDirectory();
    readMemberHome(session.id);
  });
  group("member api", memberApis);
};

export { journey, loadOptions as options, setup };

import { chmod, copyFile, mkdir, rm } from "node:fs/promises";
import { ensure, mailpit, privateDirectoryMode, privateFileMode, run } from "./support.ts";
import { findMessagesTo } from "./mail.ts";
import path from "node:path";
import { requestTimeout } from "./http.ts";

type Closable = Readonly<{ close: () => Promise<void> }>;

interface Workspace {
  readonly directory: string;
  readonly id: string;
  readonly local: string;
}

const logAudiences = ["user", "admin", "wiki"];

async function failureOf(label: string, tasks: readonly Promise<unknown>[]): Promise<string[]> {
  const results = await Promise.allSettled(tasks);
  return results.some((result) => result.status === "rejected") ? [label] : [];
}

async function copyLog(workspace: Workspace, audience: string): Promise<void> {
  const target = path.join(workspace.local, "logs", `e2e-last-${audience}.log`);
  await rm(target, { force: true });
  try {
    await copyFile(path.join(workspace.directory, `${audience}.log`), target);
  } catch {
    return;
  }
  await chmod(target, privateFileMode);
}

async function deleteMessages(ids: readonly string[]): Promise<void> {
  const response = await fetch(`${mailpit}/api/v1/messages`, {
    body: JSON.stringify({ IDs: ids }),
    headers: { "content-type": "application/json" },
    method: "DELETE",
    signal: AbortSignal.timeout(requestTimeout.short),
  });
  ensure(response.ok, "E2E_MAIL_DELETE_FAILED");
}

class StackResources {
  readonly #browsers = new Set<Closable>();
  readonly #messages = new Set<string>();
  readonly #ports = new Set<Closable>();
  readonly #registrations = new Set<string>();
  readonly #sessions = new Set<string>();
  readonly #workspace: Workspace;

  public constructor(workspace: Workspace) {
    this.#workspace = workspace;
  }

  public addBrowser(browser: Closable): void {
    this.#browsers.add(browser);
  }

  public addPort(port: Closable): void {
    this.#ports.add(port);
  }

  public addSession(session: string): void {
    this.#sessions.add(session);
  }

  public ownMessage(messageId: string): void {
    this.#messages.add(messageId);
  }

  public register(email: string): void {
    this.#registrations.add(email);
  }

  public async killSession(session: string): Promise<void> {
    if (!this.#sessions.has(session)) {
      return;
    }
    await run("tmux", ["kill-session", "-t", session]);
    this.#sessions.delete(session);
  }

  public async cleanup(): Promise<void> {
    const browserErrors = await this.#closeBrowsers();
    const workerErrors = await failureOf(
      "worker-exited",
      [...this.#sessions].map(async (session) => run("tmux", ["kill-session", "-t", session])),
    );
    await this.#preserveLogs();
    const mailErrors = await this.#deleteOwnedMail();
    const portErrors = await failureOf(
      "port-reservation",
      [...this.#ports].map(async (port) => port.close()),
    );
    await this.#removeWorkspace();
    const errors = [...browserErrors, ...workerErrors, ...mailErrors, ...portErrors];
    ensure(errors.length === 0, `E2E_CLEANUP_FAILED: ${[...new Set(errors)].join(",")}`);
  }

  async #closeBrowsers(): Promise<string[]> {
    const errors: string[] = [];
    for (const browser of this.#browsers) {
      try {
        await browser.close();
      } catch {
        errors.push("browser");
      }
    }
    return errors;
  }

  async #preserveLogs(): Promise<void> {
    await mkdir(path.join(this.#workspace.local, "logs"), {
      mode: privateDirectoryMode,
      recursive: true,
    });
    await Promise.all(logAudiences.map(async (audience) => copyLog(this.#workspace, audience)));
  }

  async #deleteOwnedMail(): Promise<string[]> {
    const searches = await Promise.allSettled(
      [...this.#registrations].map(async (email) => findMessagesTo(email)),
    );
    const found = searches.flatMap((search) => (search.status === "fulfilled" ? search.value : []));
    for (const messageId of found) {
      this.#messages.add(messageId);
    }
    const searchErrors = searches.some((search) => search.status === "rejected")
      ? ["mail-search"]
      : [];
    if (this.#messages.size === 0) {
      return searchErrors;
    }
    return [
      ...searchErrors,
      ...(await failureOf("mail-delete", [deleteMessages([...this.#messages])])),
    ];
  }

  async #removeWorkspace(): Promise<void> {
    const { directory, local } = this.#workspace;
    ensure(
      path.dirname(directory) === local && path.basename(directory).startsWith("e2e-"),
      "E2E_UNSAFE_CLEANUP_PATH",
    );
    await rm(directory, { force: false, recursive: true });
  }
}

type StackResourcesHandle = Readonly<Pick<StackResources, keyof StackResources>>;

export { StackResources };
export type { StackResourcesHandle, Workspace };

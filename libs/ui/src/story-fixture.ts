import type { ActionState } from "./action";
import type { SessionView } from "./protocol";
import type { SettingsContext } from "./mfa-types";
import type { TextInput } from "./use-text-input";
import { noop } from "es-toolkit";

function textInput(value = ""): TextInput {
  return { handleChange: noop, setValue: noop, value };
}

function idleAction(): ActionState {
  return { blocked: false, error: undefined, pending: false, run: noop };
}

function pendingAction(): ActionState {
  return { blocked: true, error: undefined, pending: true, run: noop };
}

function failedAction(error: string): ActionState {
  return { blocked: false, error, pending: false, run: noop };
}

function session(overrides: Partial<SessionView["user"]> = {}, strong = true): SessionView {
  return {
    strong,
    user: {
      email: "taro@example.com",
      id: "user_01",
      name: "山田 太郎",
      role: "user",
      twoFactorEnabled: false,
      ...overrides,
    },
  };
}

function settingsContext(overrides: Partial<SettingsContext> = {}): SettingsContext {
  return {
    action: idleAction(),
    onNotice: noop,
    onNoticeClear: noop,
    recovery: undefined,
    session: session(),
    ...overrides,
  };
}

export { failedAction, idleAction, pendingAction, session, settingsContext, textInput };

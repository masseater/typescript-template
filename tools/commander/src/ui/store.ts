import { AppState, ChatEvent, LedgerState, Snapshot, applyChat } from "#contract.ts";
import { Option, Schema } from "effect";
import { useSyncExternalStore } from "react";

type App = typeof AppState.Type;
type View =
  | { readonly status: "connecting" }
  | { readonly status: "invalid" }
  | { readonly app: App; readonly connected: boolean; readonly status: "live" };
type Message = Readonly<{ data: unknown }>;

const decoders = {
  chat: Schema.decodeUnknownOption(Schema.fromJsonString(ChatEvent)),
  ledger: Schema.decodeUnknownOption(Schema.fromJsonString(LedgerState)),
  state: Schema.decodeUnknownOption(Schema.fromJsonString(AppState)),
  tasks: Schema.decodeUnknownOption(Schema.fromJsonString(Snapshot)),
};
const listeners = new Set<() => void>();
const sources: EventSource[] = [];
const current: { view: View } = { view: { status: "connecting" } };

function show(next: View): void {
  current.view = next;
  for (const listener of listeners) {
    listener();
  }
}

function change(update: (app: App) => App): void {
  if (current.view.status === "live") {
    show({ ...current.view, app: update(current.view.app) });
  }
}

function receive<Value>(
  decode: (data: unknown) => Option.Option<Value>,
  apply: (value: Value) => void,
): (message: Message) => void {
  return (message) => {
    const decoded = decode(message.data);
    if (Option.isSome(decoded)) {
      apply(decoded.value);
    } else {
      show({ status: "invalid" });
    }
  };
}

const handlers = {
  chat: receive(decoders.chat, (event) => {
    change((app) => ({ ...app, chat: applyChat(app.chat, event) }));
  }),
  ledger: receive(decoders.ledger, (ledger) => {
    change((app) => ({ ...app, ledger }));
  }),
  state: receive(decoders.state, (app) => {
    show({ app, connected: true, status: "live" });
  }),
  tasks: receive(decoders.tasks, (tasks) => {
    change((app) => ({ ...app, tasks }));
  }),
};

function disconnected(): void {
  if (current.view.status === "live") {
    show({ ...current.view, connected: false });
  }
}

function connect(): EventSource {
  const events = new EventSource("/api/events");
  events.addEventListener("state", handlers.state);
  events.addEventListener("tasks", handlers.tasks);
  events.addEventListener("ledger", handlers.ledger);
  events.addEventListener("chat", handlers.chat);
  events.addEventListener("error", disconnected);
  return events;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (sources.length === 0) {
    sources.push(connect());
  }
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): View {
  return current.view;
}

function useView(): View {
  return useSyncExternalStore(subscribe, snapshot);
}

export { useView };

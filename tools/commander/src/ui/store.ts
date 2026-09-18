import { Option, Schema } from "effect";
import { useSyncExternalStore } from "react";

import { AppState, ChatEvent, LedgerState, Snapshot, receiveChat } from "#contract.ts";

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
const retryDelay = 3000;

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
    change((app) => ({ ...app, chat: receiveChat(app.chat, event) }));
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

function connect(): void {
  const events = new EventSource("/api/events");
  events.addEventListener("state", handlers.state);
  events.addEventListener("tasks", handlers.tasks);
  events.addEventListener("ledger", handlers.ledger);
  events.addEventListener("chat", handlers.chat);
  events.addEventListener("error", () => {
    if (current.view.status === "live") {
      show({ ...current.view, connected: false });
    }
    if (events.readyState === EventSource.CLOSED) {
      setTimeout(connect, retryDelay);
    }
  });
  sources.splice(0, sources.length, events);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (sources.length === 0) {
    connect();
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

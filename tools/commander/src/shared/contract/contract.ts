import { Schema } from "effect";

const Comment = Schema.Struct({
  author: Schema.String,
  createdAt: Schema.String,
  id: Schema.String,
  text: Schema.String,
});

const Task = Schema.Struct({
  acceptance: Schema.String,
  assignee: Schema.optionalKey(Schema.String),
  blockedBy: Schema.Array(Schema.String),
  closeReason: Schema.optionalKey(Schema.String),
  description: Schema.String,
  id: Schema.String,
  labels: Schema.Array(Schema.String),
  priority: Schema.Number,
  thread: Schema.Array(Comment),
  title: Schema.String,
});

const Snapshot = Schema.Struct({
  done: Schema.Array(Task),
  needsHuman: Schema.Array(Task),
  ready: Schema.Array(Task),
  review: Schema.Array(Task),
  running: Schema.Array(Task),
  waiting: Schema.Array(Task),
});

const ChatBody = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("user"), text: Schema.String }),
  Schema.Struct({ kind: Schema.Literal("commander"), text: Schema.String }),
  Schema.Struct({ kind: Schema.Literal("tool"), summary: Schema.String }),
  Schema.Struct({
    kind: Schema.Literal("notice"),
    notice: Schema.Literals(["stopped", "failed", "session_restarted", "denied", "woken"]),
  }),
]);

const ChatEntry = Schema.Struct({ body: ChatBody, id: Schema.Number });

const ChatStep = Schema.Union([
  Schema.Struct({ entry: ChatBody, type: Schema.Literal("entry") }),
  Schema.Struct({ text: Schema.String, type: Schema.Literal("delta") }),
  Schema.Struct({ busy: Schema.Boolean, type: Schema.Literal("busy") }),
  Schema.Struct({ text: Schema.String, type: Schema.Literal("queued") }),
  Schema.Struct({ type: Schema.Literal("taken") }),
]);

const ChatEvent = Schema.Struct({ change: ChatStep, version: Schema.Number });

const LedgerState = Schema.Struct({
  directory: Schema.String,
  status: Schema.Literals(["ready", "missing", "unreadable"]),
});

const Chat = Schema.Struct({
  busy: Schema.Boolean,
  entries: Schema.Array(ChatEntry),
  queued: Schema.Array(Schema.Struct({ id: Schema.Number, text: Schema.String })),
  version: Schema.Number,
});

const AppState = Schema.Struct({
  chat: Chat,
  ledger: LedgerState,
  tasks: Schema.optionalKey(Snapshot),
});

const TextInput = Schema.Struct({
  text: Schema.String.check(Schema.isNonEmpty()),
});

const NoInput = Schema.Struct({});
const Done = Schema.Struct({});

const ServerEvent = Schema.Union([
  Schema.Struct({ data: AppState, event: Schema.Literal("state") }),
  Schema.Struct({ data: LedgerState, event: Schema.Literal("ledger") }),
  Schema.Struct({ data: Snapshot, event: Schema.Literal("tasks") }),
  Schema.Struct({ data: ChatEvent, event: Schema.Literal("chat") }),
]);

type ChatState = typeof Chat.Type;
type ChatChange = typeof ChatStep.Type;
type ChatNotice = Extract<typeof ChatBody.Type, { readonly kind: "notice" }>["notice"];

function appended(chat: ChatState, body: typeof ChatBody.Type): ChatState {
  const last = chat.entries.at(-1);
  const id = last === undefined ? 0 : last.id + 1;
  return { ...chat, entries: [...chat.entries, { body, id }] };
}

function taken(chat: ChatState): ChatState {
  const [first, ...queued] = chat.queued;
  return first === undefined
    ? chat
    : appended({ ...chat, queued }, { kind: "user", text: first.text });
}

function replied(chat: ChatState, text: string): ChatState {
  const last = chat.entries.at(-1);
  if (last?.body.kind !== "commander") {
    return appended(chat, { kind: "commander", text });
  }
  const body = { kind: "commander", text: last.body.text + text } as const;
  return { ...chat, entries: [...chat.entries.slice(0, -1), { body, id: last.id }] };
}

function changed(chat: ChatState, change: ChatChange): ChatState {
  if (change.type === "busy") {
    return { ...chat, busy: change.busy };
  }
  if (change.type === "entry") {
    return appended(chat, change.entry);
  }
  if (change.type === "queued") {
    return { ...chat, queued: [...chat.queued, { id: chat.version, text: change.text }] };
  }
  return change.type === "taken" ? taken(chat) : replied(chat, change.text);
}

function applyChat(chat: ChatState, change: ChatChange): ChatState {
  return { ...changed(chat, change), version: chat.version + 1 };
}

function receiveChat(chat: ChatState, event: typeof ChatEvent.Type): ChatState {
  return event.version <= chat.version
    ? chat
    : { ...changed(chat, event.change), version: event.version };
}

export {
  AppState,
  ChatEntry,
  ChatEvent,
  Done,
  LedgerState,
  NoInput,
  ServerEvent,
  Snapshot,
  Task,
  TextInput,
  applyChat,
  receiveChat,
};
export type { ChatChange, ChatNotice, ChatState };

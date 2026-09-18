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
  running: Schema.Array(Task),
  waiting: Schema.Array(Task),
});

const ChatBody = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("user"), text: Schema.String }),
  Schema.Struct({ kind: Schema.Literal("commander"), text: Schema.String }),
  Schema.Struct({ kind: Schema.Literal("tool"), summary: Schema.String }),
  Schema.Struct({
    kind: Schema.Literal("notice"),
    notice: Schema.Literals(["stopped", "failed", "session_restarted", "denied"]),
  }),
]);

const ChatEntry = Schema.Struct({ body: ChatBody, id: Schema.Number });

const ChatEvent = Schema.Union([
  Schema.Struct({ entry: ChatBody, type: Schema.Literal("entry") }),
  Schema.Struct({ text: Schema.String, type: Schema.Literal("delta") }),
  Schema.Struct({ busy: Schema.Boolean, type: Schema.Literal("busy") }),
]);

const LedgerState = Schema.Struct({
  directory: Schema.String,
  status: Schema.Literals(["ready", "missing", "unreadable"]),
});

const Chat = Schema.Struct({ busy: Schema.Boolean, entries: Schema.Array(ChatEntry) });

const AppState = Schema.Struct({
  chat: Chat,
  ledger: LedgerState,
  tasks: Schema.optionalKey(Snapshot),
});

const TextInput = Schema.Struct({
  text: Schema.String.check(Schema.isNonEmpty()),
});

type ChatState = typeof Chat.Type;
type ChatChange = typeof ChatEvent.Type;
type ChatNotice = Extract<typeof ChatBody.Type, { readonly kind: "notice" }>["notice"];

function appended(chat: ChatState, body: typeof ChatBody.Type): ChatState {
  const last = chat.entries.at(-1);
  const id = last === undefined ? 0 : last.id + 1;
  return { ...chat, entries: [...chat.entries, { body, id }] };
}

function applyChat(chat: ChatState, event: ChatChange): ChatState {
  if (event.type === "busy") {
    return { ...chat, busy: event.busy };
  }
  if (event.type === "entry") {
    return appended(chat, event.entry);
  }
  const last = chat.entries.at(-1);
  if (last?.body.kind !== "commander") {
    return appended(chat, { kind: "commander", text: event.text });
  }
  const body = { kind: "commander", text: last.body.text + event.text } as const;
  return { ...chat, entries: [...chat.entries.slice(0, -1), { body, id: last.id }] };
}

export { AppState, ChatEntry, ChatEvent, LedgerState, Snapshot, Task, TextInput, applyChat };
export type { ChatChange, ChatNotice, ChatState };

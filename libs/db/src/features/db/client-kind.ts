import { CLIENT_KIND, clientKinds } from "@repo/config";

type ClientKind = (typeof clientKinds)[number];

const AGGREGATE_CLIENT_KIND: ClientKind = CLIENT_KIND.total;

const aiPattern = /anthropic|chatgpt|claude|copilot|cursor|gpt|mcp|openai/iu;
const botPattern = /bot|crawler|spider|slurp/iu;

function clientKindOf(userAgent: string | null | undefined): ClientKind {
  if (userAgent === null || userAgent === undefined || userAgent.length === 0) {
    return CLIENT_KIND.human;
  }
  if (aiPattern.test(userAgent)) {
    return CLIENT_KIND.ai;
  }
  if (botPattern.test(userAgent)) {
    return CLIENT_KIND.bot;
  }
  return CLIENT_KIND.human;
}

export { AGGREGATE_CLIENT_KIND, clientKindOf };
export type { ClientKind };

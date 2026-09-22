/** @canonical-values dev.browser-agent-command */
const browserAgentCommands = ["open", "find", "label", "fill", "eval", "wait"] as const;

export const BROWSER_AGENT_COMMAND = {
  eval: browserAgentCommands[4],
  fill: browserAgentCommands[3],
  find: browserAgentCommands[1],
  label: browserAgentCommands[2],
  open: browserAgentCommands[0],
  wait: browserAgentCommands[5],
} as const;

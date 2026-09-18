const secretName = String.raw`[\w.-]*(?:secret|token|password|passphrase|cookie|authorization|api[_-]?key)[\w.-]*`;
const secretAssignment = new RegExp(
  String.raw`(?<quote>"?)(?<name>${secretName})\k<quote>(?<separator>[ \t]*[:=][ \t]*)(?:"[^"]*"|'[^']*'|[^\n]*)`,
  "giu",
);
const placeholder = "[redacted]";

function redactSecrets(value: string): string {
  return value.replaceAll(secretAssignment, `$<quote>$<name>$<quote>$<separator>${placeholder}`);
}

export { redactSecrets };

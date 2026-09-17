export function secretViolations(filename: string, content: string): string[] {
  const violations: string[] = [];
  if (
    /(?:^|\/)(?:\.local(?:-agents)?|\.artifacts)(?:\/|$)/.test(filename) ||
    (/(?:^|\/)(?:\.dev\.vars(?:\..*)?|\.env(?:\..*)?)$/.test(filename) &&
      !filename.endsWith("/.env.example") &&
      filename !== ".env.example")
  )
    violations.push("private-file");
  if (/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/.test(content))
    violations.push("private-key");
  if (/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/.test(content)) violations.push("aws-access-key");
  if (/\bgh[pousr]_[A-Za-z0-9]{36,255}\b|\bgithub_pat_[A-Za-z0-9_]{60,255}\b/.test(content))
    violations.push("github-token");
  return violations;
}

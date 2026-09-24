const agentTool = "playwright";

const agentUserAgent = `Mozilla/5.0 (compatible; Cursor/1.0) AI-Agent/${agentTool}`;

const agentBrowserHeaders = (address: string): Readonly<Record<string, string>> => ({
  "cf-connecting-ip": address,
  "user-agent": agentUserAgent,
});

export { agentBrowserHeaders, agentUserAgent };

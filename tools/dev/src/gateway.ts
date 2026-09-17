import { connect, createServer } from "node:net";

const firstUserArgumentIndex = 2;
const highestPrivilegedPort = 1024;
const httpsPort = 443;
const [targetArgument] = process.argv.slice(firstUserArgumentIndex);
const target = Number(targetArgument);
if (!Number.isInteger(target) || target <= highestPrivilegedPort) {
  throw new Error("A proxy port above 1024 is required");
}

createServer((client) => {
  const upstream = connect(target, "127.0.0.1");
  client.pipe(upstream).pipe(client);
  client.on("error", () => upstream.destroy());
  upstream.on("error", () => client.destroy());
}).listen({ host: "::", port: httpsPort }, () => {
  console.info(JSON.stringify({ event: "local.gateway_listening", port: httpsPort, target }));
});

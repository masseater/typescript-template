import { connect, createServer } from "node:net";

const target = Number(process.argv[2]);
if (!Number.isInteger(target) || target <= 1024)
  throw new Error("A proxy port above 1024 is required");

createServer((client) => {
  const upstream = connect(target, "127.0.0.1");
  client.pipe(upstream).pipe(client);
  client.on("error", () => upstream.destroy());
  upstream.on("error", () => client.destroy());
}).listen({ port: 443, host: "::" }, () => {
  console.info(JSON.stringify({ event: "local.gateway_listening", port: 443, target }));
});

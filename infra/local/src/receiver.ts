const OTLP_PORT = 4318;
const LOKI_PORT = 3100;
const TEMPO_PORT = 3200;

const receiverPorts = { logs: LOKI_PORT, otlp: OTLP_PORT, traces: TEMPO_PORT } as const;

function receiverOrigin(signal: keyof typeof receiverPorts): string {
  return `http://127.0.0.1:${receiverPorts[signal]}`;
}

export { receiverOrigin, receiverPorts };

const monitorStacks = ["budget-monitor", "error-monitor", "health-monitor"] as const;

type MonitorStack = (typeof monitorStacks)[number];

export { monitorStacks };
export type { MonitorStack };

function captureObservers(): () => void {
  const original = globalThis.PerformanceObserver;
  const captured = new Set<PerformanceObserver>();
  class CapturedObserver extends original {
    public constructor(report: PerformanceObserverCallback) {
      super(report);
      captured.add(this);
    }
  }
  globalThis.PerformanceObserver = CapturedObserver;
  return () => {
    if (globalThis.PerformanceObserver === CapturedObserver) {
      globalThis.PerformanceObserver = original;
    }
    for (const observer of captured) {
      observer.disconnect();
    }
    captured.clear();
  };
}

export { captureObservers };

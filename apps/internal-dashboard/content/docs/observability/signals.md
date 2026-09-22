---
title: Tracing / Logging / Profiling
description: 同じ trace id で、区間と文言とスタックを残す
---

Tracing は span の木、Logging は起きたことの文言、Profiling は実行中のスタックの標本である。三つは別の信号で、同じ trace id を持つと同じ要求へ戻れる。Metrics は「遅い」こと、trace は「どの要求のどこが遅い」こと、profile は「その時間にスタックのどの関数にいた」ことを持つ。

Continuous profiling は、本番のプロセスから一定間隔でスタックを取り続ける。一回だけ取るプロファイルは、止めるより前の実行を残さない。Flame graph は、同じスタックが標本に何回出たかを横幅で示す。pprof はその標本の形式の一つである。

```text
span  user.load  trace_id=4bf92f3577b34da6a3ce929d0e0e4736  span_id=00f067aa0ba902b7
log   user.load  trace_id=4bf92f3577b34da6a3ce929d0e0e4736  message="行が無かった"
prof  user.load
        db.query
          read
      trace_id=4bf92f3577b34da6a3ce929d0e0e4736
```

span は `user.load` がいつ始まりいつ終わったかを持つ。ログは、その途中で「行が無かった」という文言を同じ trace id で残す。プロファイルは、その時間帯にスタックが `db.query` の `read` にいた標本を持つ。件数や分位点へ戻すのは [Exemplars](/observability/exemplars) で、これらの信号を目標の割合と比べるのが [SLI / SLO](/observability/sli-slo) である。

## 参考文献

- 公式 — [Traces](https://opentelemetry.io/docs/concepts/signals/traces/)
- 公式 — [Logs](https://opentelemetry.io/docs/concepts/signals/logs/)
- 公式 — [Profiles](https://opentelemetry.io/docs/concepts/signals/profiles/)

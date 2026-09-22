---
title: Gateway API
description: クラスタの外から入る HTTP を、どのバックエンドへ渡すか宣言する
---

Gateway API は、クラスタの外から入る HTTP を、どのバックエンドへ渡すかを宣言する。`HTTPRoute` が URL の一致条件とバックエンドを持ち、Gateway がその宣言をプロキシへ渡す。一致した要求を span やアクセスログにするのは、そのプロキシである。

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: users
spec:
  parentRefs:
    - name: public
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /users
      backendRefs:
        - name: users
          port: 80
```

`/users/123` はこの規則に一致し、`users` の 80 番へ進む。`HTTPRoute` は span を定義しない。記録するのは、その一致条件を実装するプロキシである。Envoy をデータ面にする実装は、一致した要求の [W3C Trace Context](/observability/trace-context) を上流へ渡す。クラスタの中の Pod 同士をプロキシで仲介するのは [Service Mesh](/observability/service-mesh) である。

## 参考文献

- 公式 — [Gateway API](https://gateway-api.sigs.k8s.io/)
- 公式 — [Guides](https://gateway-api.sigs.k8s.io/guides/)
- 公式 — [HTTPRoute](https://gateway-api.sigs.k8s.io/reference/api-types/httproute/)
- サンプル — [kubernetes-sigs/gateway-api](https://github.com/kubernetes-sigs/gateway-api)

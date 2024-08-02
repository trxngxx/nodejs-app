# Monitor tool for example Node JS Application #

## Hướng dẫn cài đặt ##
```bash
https://doc.seta-international.vn/x/TgCTAg
```


## Lưu ý configmap của service ##
```bash
cat << EOF > istio-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: istio
  namespace: istio-system
data:
  mesh: |-
    accessLogFile: /dev/stdout
    defaultConfig:
      discoveryAddress: istiod.istio-system.svc:15012
      tracing:
        sampling: 100.0
        zipkin:
          address: zipkin.istio-system:9411
    defaultProviders:
      metrics:
      - prometheus
    enablePrometheusMerge: true
    extensionProviders:
    - envoyOtelAls:
        port: 4317
        service: opentelemetry-collector.observability.svc.cluster.local
      name: otel
    - name: skywalking
      skywalking:
        port: 11800
        service: tracing.istio-system.svc.cluster.local
    - name: otel-tracing
      opentelemetry:
        port: 4317
        service: opentelemetry-collector.observability.svc.cluster.local
    rootNamespace: istio-system
    trustDomain: cluster.local
  meshNetworks: 'networks: {}'
EOF
```
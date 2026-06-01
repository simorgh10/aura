# Shipping Coordinator Worker

The **Shipping Coordinator Worker** is an asynchronous Spring Boot application. It listens for approved order events and coordinates downstream manifesting sequences.

### Technical Spec
- **Event Consumption:** Consumes events from the payment success topic.
- **Payload Processing:** Generates structured shipping manifests in JSON format.
- **Egress:** Safely uploads raw manifests to dedicated S3 bucket paths.

---

> [!TIP]
> This worker leverages pre-allocated concurrency limits to prevent message throttling during high-throughput sales events.

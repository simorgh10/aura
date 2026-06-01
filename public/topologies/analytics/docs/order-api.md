# Order API Service

The **Order API Service** is a high-performance, stateless RESTful service built with Spring Boot and reactive WebFlux. It serves as the primary entry point for all order placements.

### Endpoints
- `POST /v1/orders` - Initiates checkout process.
- `GET /v1/orders/{id}` - Retrieves order execution status.
- `DELETE /v1/orders/{id}` - Cancels a pending order if not already processed.

### Dynamic Profile Specs
- **Kubernetes Pod Configuration:** Deployed with `3 replicas` in environment clusters.
- **Resource Allocations:**
  - CPU Limits: `1000m`
  - Memory Limits: `2Gi`

---

> [!WARNING]
> Database operations are highly transactional. Ensure proper scaling of read replicas to handle high traffic periods.

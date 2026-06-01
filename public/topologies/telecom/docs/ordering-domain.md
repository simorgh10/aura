# Ordering Subsystem

The **Ordering Subsystem** handles all business processes related to the creation, validation, and lifecycle of user purchases. It operates under strict consistency requirements and is fully containerized.

### Key Responsibilities
- **Cart Checkout:** Ingests raw client cart structures and executes checkout workflows.
- **Inventory Check:** Blocks checkout if items are no longer available in the central stock cache.
- **Fulfillment Dispatch:** Sends structured messages downstream upon successful validation.

### Architecture Overview
This domain encompasses the **Order API Service** (high-throughput microservice) and **Order DB** (highly available transactional PostgreSQL instance).

---

> [!NOTE]
> All services within this domain are deployed inside the Kubernetes namespace `core-ordering` under the `us-east-1` AWS region.

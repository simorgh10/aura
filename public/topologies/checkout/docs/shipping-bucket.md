# S3 Manifest Storage

The **S3 Manifest Storage** bucket acts as the primary data lake repository for generated fulfillment and shipping dispatch sheets.

### Lifecycle Configurations
- **Standard Storage:** Active sheets remain in high-availability tiers for `14 days`.
- **Archive Migration:** Automatically transitions to Glacier Deep Archive after `30 days` to save cost.
- **Purging:** Cleaned permanently after `365 days`.

---

> [!IMPORTANT]
> Bucket permissions are strictly locked down via VPC endpoint policy locks, permitting ingress only from Fulfillment workers.

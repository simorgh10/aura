# Transactions Database

The **Transactions Database** is a highly secured, transaction-isolated PostgreSQL cluster configured in a Multi-AZ replica model. It stores authorization records, client billing tokens, and clearings.

### Integrity Controls
- **Column Encryption:** Enforced at rest using AWS KMS envelope keys for account identifiers.
- **Continuous Backups:** Automated point-in-time recovery (PITR) with a retention window of `35 days`.

---

> [!CAUTION]
> Direct read or write access is prohibited. All operations must proceed via tokenized, cryptographic application microservices.

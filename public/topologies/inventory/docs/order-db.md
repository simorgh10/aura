# Order Database

The **Order Database** is a multi-AZ Amazon Aurora PostgreSQL cluster designed to store all transaction, client, and item ledger states with high fidelity.

### Performance Tunings
- **Connection Pool:** Managed via PgBouncer with a maximum pool size of `200`.
- **Query Caching:** Accelerated using ElastiCache Redis for catalog indexes.

---

> [!CAUTION]
> Direct manual queries on production tables are strictly forbidden without explicit authorization from the Data Security Board.

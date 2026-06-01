# Stripe Integrator Core

The **Stripe Integrator Core** gateway manages tokenized interactions with international credit card processing centers. It isolates PCI DSS scoped workflows from the rest of our microservice cluster.

### Security Configurations
- **Encryption:** TLS 1.3 for all egress traffic.
- **Auditing:** CloudWatch logs intercepting token signatures (fully scrubbed of sensitive PAN/CVV inputs).

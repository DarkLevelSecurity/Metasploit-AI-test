# Metasploit Web GUI Constitution

## Core Principles

### I. Authorized-Use First
The product exists to support authorized testing and operational workflows in controlled environments. Features must assume the user has explicit permission to access the connected system and must not encourage exposure of credentials, environment data, or control interfaces to untrusted networks.

### II. User-Centered Operations
Every feature must improve clarity, confidence, and speed for a person working with a live security environment. The experience should help users understand status, select the right action, and manage progress without unnecessary friction.

### III. Single Source of Truth
The system should present the current operational state as the authoritative view for the connected environment. If data is unavailable, stale, or incomplete, the interface must communicate that clearly instead of implying certainty.

### IV. Secure by Default
Credentials, tokens, settings, and operational artifacts must remain protected and stored only in appropriate local or authorized locations. Sensitive information must not be committed to the repository or exposed through default setup paths.

### V. Simple, Verifiable Delivery
Features should be scoped to clear user value, be independently testable, and avoid unnecessary complexity. Each meaningful addition must be understandable, observable, and verifiable in ordinary project workflows.

## Security and Operational Boundaries

The project is intended for local or authorized lab use. The interface must treat Metasploit environments as sensitive operational systems and preserve the principle of least exposure. This includes limiting default network exposure, requiring explicit user intent for high-impact actions, and keeping the system aligned with the user’s permissions and access boundaries.

Sensitive data must remain protected. Secret material, API keys, and environment credentials should be stored only in local user configuration or approved runtime locations, never in project source files or shared configuration artifacts. System behavior should always make it obvious when the user is acting on a live environment and when the status of a connection or task is uncertain.

## Development Workflow

All features should begin with a clear user outcome and a concise requirement definition. The team should validate the user journey before implementation, keep work focused on user value instead of technical abstraction, and confirm that new functionality remains understandable to non-technical stakeholders.

Changes should be reviewed for three things before completion: user benefit, operational safety, and readiness for real-world use. For workflows involving live connections, jobs, sessions, or generated artifacts, the feature must be judged by whether it helps the user understand and control the environment responsibly.

## Governance

This constitution governs feature specification, planning, and implementation decisions for the Metasploit Web GUI. When priorities conflict, the principles of authorized use, user clarity, and operational safety take precedence over convenience or implementation speed.

All project work should preserve the intent of the product: a trustworthy, understandable interface for interacting with an authorized Metasploit environment while maintaining clear boundaries around security, confidentiality, and operational impact.

**Version**: 1.0.0 | **Ratified**: 2026-08-20 | **Last Amended**: 2026-08-20

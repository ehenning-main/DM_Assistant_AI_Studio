# Security Specification & Threat Model

This document outlines the security invariants, the "Dirty Dozen" malicious vectors, and our target rule tests to ensure zero-trust compliance.

## 1. Data Invariants

1. **Campaign Isolation**: Every campaign session belongs to one unique `userId` and cannot be read, modified, or deleted by other authenticated or unauthenticated users.
2. **Strict Fields & Sizes**: Session parameters (like titles, summaries, and notes) must adhere strictly to predefined size thresholds (e.g. titles <= 200 chars, summaries <= 100,000 chars) to prevent "Denial of Wallet" resource exhaustion.
3. **Temporal Validity**: Timestamps (`createdAt`, `updatedAt`) are authenticated against server-generated clocks (`request.time`) to prevent retroactive backdating or frontloading of session metrics.

---

## 2. The "Dirty Dozen" Attack Payloads

The following payloads represent malicious and non-conforming attempts to insert or modify data. They are designed to verify that our regulations reject invalid attempts.

1. **Privilege Escalation**: Creating a session that references a separate user's ID as `userId`.
2. **Cross-Tenant Read**: Querying or listing sessions belonging to other users.
3. **Backdated Timestamps**: Forcing custom historical timestamps upon creation instead of using `request.time`.
4. **Post-Creation Field Modification**: Attempting to alter invariant properties like `id` or `createdAt` after the session was created.
5. **NoSQL Injection / Oversized Title**: Injecting titles larger than 200 characters in size or passing nested structures when a string is expected.
6. **Malicious ID Structure**: Injecting special characters, symbols, or directory paths in the `{sessionId}` parameter.
7. **Phantom Status Overrides**: Directly pushing administrative properties or spoofing status fields.
8. **Summary Sabotage**: Pushing an oversized body to exhaust memory during transcription lookups.
9. **Unauthenticated Access**: Reading session logs from anonymous user accounts where email verification is bypassed.
10. **Shadow Updates**: Injecting unmapped ghost attributes (e.g., `adminOwnerMode: true`) into standard updates.
11. **Immutability Breach**: Updating another user's session by keeping their `userId` but overriding document fields.
12. **Malformed Types**: Storing lists where strings are required (e.g., setting `audioUrl` to an array).

---

## 3. Test Specification

All "Dirty Dozen" attack payloads should result in `PERMISSION_DENIED` within Firestore engine testing. The security rules defined in `/firestore.rules` protect these entities by comparing input properties with `request.auth.uid`, validating fields against the `isValidSession` schema function, and ensuring invariant integrity.

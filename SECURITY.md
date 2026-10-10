# Security Policy

At **Meri Awaaz**, securing user privacy, creator media streams, and moderation integrity is our highest priority. The platform implements multi-tier Role-Based Access Control (RBAC), an autonomous AI Blue Team security monitoring agent, rate limiting, and encrypted session handling.

---

## Supported Versions

Only the latest release versions receive security patches and updates. We recommend all users and developers run the latest codebase.

| Version | Supported | Status |
| :--- | :---: | :--- |
| `v1.0.x` | :white_check_mark: | Current Stable Release (Unified Engine & AI Security) |
| `< 1.0.0` | :x: | End of Life (Unsupported) |

---

## Reporting a Security Vulnerability

We follow a strict **Responsible Disclosure Policy**. Please review the guidelines below before submitting a report:

### :lock: Private Security Reports (CRITICAL — DO NOT OPEN PUBLIC ISSUES)

If you discover a vulnerability that could compromise user security, moderator workflows, or authentication systems, **DO NOT open a public GitHub Issue, pull request, or discussion**. Public disclosure before a patch exposes users to active exploits.

Please report the following categories exclusively through **GitHub Private Vulnerability Reporting**:

- **Remote Code Execution (RCE)** or arbitrary code execution via file upload or media transcoders
- **Local File Inclusion (LFI)** or Path Traversal (`../`) in media serving routes or endpoints
- **Authentication & Authorization Bypass**: Privilege escalation to Moderator or Super Admin roles
- **Credential & Token Leakage**: JWT secret exposure, Telegram bot token leakage, or session hijacking
- **AI Security / Rate Limit Bypass**: Evasion of the autonomous AI Blue Team monitor or IP blocklist mechanisms
- **Database Injection**: NoSQL injection in MongoDB queries or ORM flaws
- **Sensitive Data Exposure**: Unauthorized access to private user profiles or guest leakage

#### How to Submit:
1. Navigate to the repository's **[Security Advisories](https://github.com/sentinal404/MeriAwaaz-Streaming-Platform/security/advisories/new)** tab.
2. Click **"Report a vulnerability"** to submit a confidential report.
3. Provide a clear description, proof of concept (PoC) or reproduction steps, and the affected version/environment.
4. For urgent coordination, you can connect directly with the maintainer via **[LinkedIn](https://www.linkedin.com/in/rishishakya)** or **[GitHub Profile](https://github.com/sentinal404)**.

---

### :beetle: Public Bug Reports (Functional & Non-Security Issues)

If you encounter general software bugs, UI glitches, or performance issues that **do not present a security or privacy threat**, please submit a standard issue:

- Frontend layout anomalies, CSS/Tailwind responsiveness, or UI alignment
- Video player buffering, codec compatibility, or playback controls
- Notification counter sync or profile avatar render issues
- Feature suggestions, design critiques, and documentation improvements

:link: **Submit public bugs here:** [Open GitHub Issue](https://github.com/sentinal404/MeriAwaaz-Streaming-Platform/issues/new)

---

## Response Timeline & SLA

When you submit a private security disclosure, our response workflow follows these target commitments:

1. **Initial Acknowledgment**: Within **24 to 48 hours**, confirming receipt of the report.
2. **Assessment & Triage**: Within **72 hours**, assessing CVSS severity and reproducing the vulnerability.
3. **Remediation & Patching**: A security fix is engineered in a private branch and verified against regression tests.
4. **Coordinated Disclosure**: A public patch is deployed alongside an advisory credit acknowledging the security researcher.

---

## Safe Harbor Commitment

We support security research conducted in good faith. If you:
- Make a good faith effort to avoid privacy violations, destruction of data, and interruption of services.
- Keep the vulnerability details confidential until a patch has been published and released.
- Do not exploit the vulnerability beyond what is strictly necessary to establish proof of concept.

We commit to:
- Not pursuing legal action against you or initiating law enforcement investigations for your research.
- Working cooperatively with you to understand, remediate, and credit your discovery.

Thank you for helping keep Meri Awaaz and its creators safe!

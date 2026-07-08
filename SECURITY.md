# Security Policy

## Supported versions

`@infinite-canvas/react` is pre-1.0. Only the latest `0.1.x` release receives fixes.

| Version | Supported |
| ------- | --------- |
| `0.1.x` | Yes       |
| `< 0.1` | No        |

There are no long-term support branches, and there will not be any before 1.0. Patches land on
`main` and go out in the next release; older `0.1.x` patch releases are not backported to.

## Scope

This is a client-side React library. It renders a canvas of windows in the browser, persists
document-scoped state to browser storage, and — optionally — rasterizes DOM into WebGL/WebGPU
textures. Things that are in scope:

- Cross-site scripting or DOM-injection reachable through the library's own rendering or through the
  serialized/persisted state it reads back,
- Prototype pollution or unsafe deserialization in the persistence and validation layers,
- Anything that lets untrusted persisted state escape the sandbox the consuming app expects.

Out of scope: vulnerabilities in the playground app (`apps/playground`, private, never published),
issues that require a consumer to deliberately render attacker-controlled markup they trust, and
anything that only affects a browser or GPU driver rather than this code.

## Reporting a vulnerability

**Please do not open a public GitHub issue for a security vulnerability.** Public issues are how a
not-yet-fixed problem gets weaponized.

Instead, email **tyler.davis.mitchell@gmail.com** with:

- a description of the issue and why you believe it's a security problem,
- the affected version,
- a minimal reproduction, or the steps to build one,
- the impact you think it has.

If you'd rather use GitHub's private reporting flow, you can also open a draft advisory from the
Security tab of <https://github.com/tyler-mitchell/infinite-canvas>.

## What to expect

Honest expectations, since a promise nobody can keep is worse than no promise:

This is a pre-1.0 project maintained by one person in their spare time. Response is **best-effort**.
There is no service-level agreement, no guaranteed acknowledgement window, and no bug bounty. In
practice you can expect an acknowledgement within a couple of weeks; if you haven't heard anything
after that, feel free to send a follow-up email — the first one probably got buried, not ignored.

When a report is confirmed:

1. The fix is developed privately.
2. A patched `0.1.x` is published.
3. A GitHub security advisory is filed, crediting you unless you'd rather stay anonymous.

If you disclose publicly before a fix ships, that's your call to make — but please give it a
reasonable window first. Nobody is served by a working exploit and no patch.

Thank you for reporting responsibly.

# Security policy

## Supported versions

`@hyphened/infinite-canvas` is pre-1.0. Only the latest `0.2.x` release receives fixes.

| Version | Supported |
| ------- | --------- |
| `0.2.x` | Yes       |
| `< 0.2` | No        |

There are no long-term support branches before version 1.0. Patches enter `main`. The next release includes them.

The maintainer does not backport fixes to older `0.2.x` releases.

## Scope

This client-side React library renders windows in a browser. It stores document-scoped state in browser storage.

The optional rasterizer converts DOM content to WebGL or WebGPU textures.

These security problems are in scope:

- Cross-site scripting or DOM injection through library rendering
- Cross-site scripting or DOM injection through restored state
- Prototype pollution or unsafe deserialization in persistence and validation
- Untrusted state that escapes the sandbox of the consumer application.

These security problems are out of scope:

- Vulnerabilities in private, unpublished workspace applications
- Markup that a consumer deliberately accepts as trusted
- Problems that affect only a browser or GPU driver.

## Report a vulnerability

Do not open a public GitHub issue for a security vulnerability.

Email **tyler.davis.mitchell@gmail.com** with this information:

- A description of the problem and its security effect
- The affected version
- A minimal reproduction or reproduction steps
- The expected impact.

You can also submit a draft advisory from the Security tab of <https://github.com/tyler-mitchell/infinite-canvas>.

## Response

One person maintains this pre-1.0 project during spare time. The maintainer responds when time permits.

There is no service-level agreement, guaranteed response period, or bug bounty. An acknowledgment usually arrives within two weeks.

If no acknowledgment arrives after two weeks, send a follow-up email.

After the maintainer confirms a report:

1. The maintainer develops the fix privately.
2. The maintainer publishes a patched `0.2.x` release.
3. The maintainer files a GitHub security advisory.

The advisory gives you credit unless you request anonymity.

Before public disclosure, give the maintainer time to publish a fix. Public disclosure without a patch can expose users.

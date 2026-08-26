# Polkadot implementation gates

These rules are an admission gate for every change under `apps/polkadot`.
Feature work does not begin until the relevant row in `AFFORDANCE_AUDIT.md`
contains evidence and an accepted implementation authority.

## Framework-first decision gate

Before implementing a capability:

1. Use Type Atlas to inspect the infinite-canvas public API, implementation,
   tests, and canonical playground consumers.
2. Record the applicable framework affordance in `AFFORDANCE_AUDIT.md`.
3. If the framework already owns the invariant, consume it directly.
4. If a reusable canvas invariant is missing, implement and test the ergonomic
   framework affordance first, then keep Polkadot as a thin consumer.
5. For non-canvas infrastructure, inspect current official package docs and
   installed source before choosing a maintained library-native API.
6. Product-owned code is limited to Polkadot domain policy and composition.

An unverified or rejected audit row closes the development gate for that area.
The record is written before implementation. A post-hoc justification does not
satisfy the gate.

## Sequence gate

Work only on the earliest phase whose exit conditions remain open. A later
phase may contribute the minimum code required to prove the current spine; the
reason and bounded scope must be recorded in `AFFORDANCE_AUDIT.md` first. Do not
build later-phase product surfaces merely because their framework helpers are
already available.

## Enforced implementation authorities

- Canvas state, geometry, interaction, commands, focus, navigation, presence,
  serialization, and overlays come from `@hyphened/infinite-canvas`.
- React keyboard registration uses `@tanstack/react-hotkeys`. Canvas commands
  remain on the framework command path. Product code never parses key events or
  installs keyboard listeners.
- Modal, focus, list-navigation, and command-menu behavior comes from shared
  `ui` primitives backed by Base UI and `cmdk`.
- Component styling is declared with `tv` from `ui/tv`. Literal or assembled
  Tailwind class strings do not belong in Polkadot JSX. Global CSS is limited to
  imports, tokens, and document-wide base rules.
- Debouncing, throttling, queuing, and retry behavior comes from TanStack Pacer.
  Product source never owns timers or promise queues.
- Browser-persisted records use SurrealDB WASM. Runtime input validation uses
  ArkType. Ephemeral reactive product state uses Legend State.
- IDs use Web Crypto unless the domain requires a different maintained format.

## Verification gate

Before an audited area is accepted:

```sh
vp -C apps/polkadot check
vp -C apps/polkadot build
```

Any framework or shared UI change also requires the repository-wide check,
tests, and builds. Passing tools cannot substitute for the framework-first
evidence gate above. Browser witnessing remains disabled until that gate closes.

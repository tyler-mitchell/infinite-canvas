---
"@hyphened/infinite-canvas": patch
---

Stop leaking a `@types/node` requirement onto consumers.

A single `process.env.NODE_ENV` reference compiled cleanly inside this package, whose tsconfig carries `"types": ["node"]` for the tests that read source from disk — and failed for anyone typechecking this source without node types, which is how the playground's build broke. `process` is now declared in module scope, keeping the literal token every bundler replaces while requiring nothing of consumers.

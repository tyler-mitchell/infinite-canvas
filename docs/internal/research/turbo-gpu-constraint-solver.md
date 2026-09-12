# Turbo: a GPU constraint solver, and whether we could build one

Objective: decide whether Turbo can be rebuilt as a reusable TypeGPU module on our substrate, and
name the real gaps.

Source: Pierre Talbot, "A GPU-based Constraint Programming Solver", AAAI 2026. Read in full
(700 lines) on 2026-09-09. Code: `github.com/ptal/turbo/tree/aaai2026`. Substrate claims checked
against `~/Projects/kek-monorepo/packages/webgpu-engine` the same day.

## What it is

An exact discrete constraint solver that runs entirely on GPU — integer interval bound propagation
plus backtracking search, no CPU in the loop. Competitive with sequential CPU solvers on the
MiniZinc 2024 challenge (better than Choco on 23% of instances, worse on 29%).

Two ideas carry it:

1. **Ternary constraint network.** Every constraint is rewritten to `x = y ⊙ z` with
   `⊙ ∈ {+ * / mod min max = ≤}`. That makes every propagator a fixed 16-byte record, so a warp
   loads 32 of them in four memory transactions and no thread takes a longer path than its
   neighbours.

   ```cpp
   struct Bytecode { int op; int x; int y; int z; };   // exactly 16 bytes, so int4 loads it
   ```

   Cost: the decomposition inflates the problem. Median 4.5x more variables and constraints, but
   the tail is brutal — up to 1316x variables on `yumi-dynamic`.

2. **Dive and solve.** Subproblems are generated on demand rather than up front, because up front
   would need 8 GB on average and 222 GB worst case. The trick is that a subproblem's index _is_
   its path down the search tree, so diving and skipping are bit operations on an atomic counter.

   ```cpp
   int dive() { --rd; return (target & (1u << rd)) >> rd; }
   void skip() { nextsub.fetch_max(((target >> rd) + 1u) << rd); }
   ```

## No ML framework, and no neural requirement

Hand-written CUDA C++. No PyTorch, no JAX, no CUDA-X ML library — raw structs, `int4` casts,
`ld.global.v4.s32`, the CUDA occupancy calculator, `syncgrid()`. The front end is MiniZinc → FlatZinc
plus a TCN decomposition described in a separate paper (arXiv 2511.11872).

Nothing in the algorithm is learned. The only neural mention is three sentences in the conclusion,
and it is a future direction rather than a dependency:

> Because Turbo runs fully on GPU, machine-learning components could be integrated more efficiently
> because they are also usually GPU-accelerated. Neural-network prediction time was identified as a
> bottleneck in previous attempts (Cappart et al. 2021).

That is the strategic point of the whole paper, and it is buried. Prior work pairing reinforcement
learning with constraint programming ran the solver on CPU and the network on GPU, so **every
branching decision paid a round trip**. The network was fast; moving to it was not. A device-resident
solver deletes that boundary. So the neural angle is not something you must build — it is the reason
building it on a substrate that already hosts a tensor framework would matter.

## Verdict

Feasible. The architecture ports cleanly, the performance story does not, and the front end is a
second project.

**The paper is a complete blueprint for the solver core.** All five algorithms, `Bytecode` and `Path`
verbatim, the index-is-the-path bit trick, the propagator contract (reductive, monotone, sound),
and the soundness/completeness proofs.

**It is not a blueprint for the front end.** TCN decomposition is deferred to another paper, and the
eight propagators are described but never listed. That is the fiddly half.

## Substrate mapping

Every primitive the search layer needs is already in production use in `webgpu-engine`:

| Turbo needs                             | We have                        | Evidence                                                                             |
| --------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------ |
| `nextsub++` — claim next subproblem     | `std.atomicAdd`                | in production                                                                        |
| `nextsub.fetch_max(...)` — skip subtree | `std.atomicMax`                | `domains/destruction/passes/voxels.ts:106`, `domains/navigation/spatial-grid.ts:421` |
| `ub.fetch_min(...)` — share best bound  | `std.atomicMin`                | `compute/disjoint-set/disjoint-set.ts:72`, `compute/segmented-u32-minimum.ts:137`    |
| domains in shared memory                | `tgpu.workgroupVar`            | `compute/key-value-radix-sort/kernels.ts:145-149` (5 arrays)                         |
| block-level fixpoint sync               | `std.workgroupBarrier`         | 85 sites across 17 files                                                             |
| lexicographic bytecode sort ⟨op,y,x,z⟩  | generic key-value radix sort   | `compute/key-value-radix-sort/`                                                      |
| chunk a long solve across frames        | three-moment model + sequences | `gpu/declaration.ts:703-742`                                                         |

The tensor framework is adjacent, not required: a solver targets the base compute substrate
(`core/assembly` + `core/capability` + `core/system`) directly and never touches the tensor IR.

## The real gaps — all WebGPU, none ours

1. **Workgroup storage: 16 KB floor against the H100's 227 KB.** This is the one that costs. Table 4
   ties nodes-per-second directly to how many instances fit in shared memory — 19/24/24/46 instances
   across four GPUs giving 94k/207k/212k/458k NPS. A 14x smaller budget falls off that curve.
2. **No recursion in WGSL.** `minimize` is written recursively; it needs an explicit decision stack.
   Tractable — Turbo already uses full recomputation rather than trailing.
3. **Long solves must chunk across dispatches.** No 20-minute kernel in a browser. The engine's
   step/present model suits this well.
4. **Subgroups are optional.** Costs the ~10% warp-centric fixpoint. `wgslExtensions` and
   `framework/fulfillment/subgroup-matrix-probe.typegpu.test.ts` are the path if wanted.

Not a gap: `syncgrid()`. A dispatch boundary is the sync, and Turbo's blocks never wait on each
other — only on an atomic counter.

## Disposition

Not scheduled. Recorded because the paper was read in full and the substrate check is done, so a
future decision starts from evidence rather than repeating both.

If it is ever taken up, the reason is the conclusion's sentence — solver and network on one device —
not having Turbo in a browser. Absent that goal the port buys a slower Turbo.

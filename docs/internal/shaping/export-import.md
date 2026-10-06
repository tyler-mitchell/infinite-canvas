---
shaping: true
---

# Project export and import — Shaping

## Source

> Absolutely nothing and especially none of these should be rushed. They should all be fully
> thought through and decisions need to come from shaping where shapes are challenged against a
> set of R and the one that wins is the one that fully fulfills that R set. And that R set must
> not be trivialized or be made narrow because it should be holistic and have a wide range of
> coverage of concerns and as well as existing project requirements.

Prompted by an agent building a JSON export end to end before any requirement set existed. That
spike is Shape A below. It is kept as a shape, not as the answer.

## Problem

A Polkadot project lives in an 11 MB SurrealDB WASM engine inside IndexedDB. There is no path out.
One cleared browser profile takes every note, canvas, relation and saved view with it. The product
plan lists JSON project export/import and Markdown note export/import as **Core**, and neither
exists.

## Outcome

A person can take their work out of Polkadot, read it without Polkadot, and put it back — and an
agent cannot do that quietly on their behalf.

---

## Requirements (R)

| ID     | Requirement                                                                                     | Status    | Source                                |
| ------ | ----------------------------------------------------------------------------------------------- | --------- | ------------------------------------- |
| **R0** | **A person can get a whole project out of the browser and back in, without Polkadot installed** | Core goal | Plan 1173                             |
| **R1** | **Coverage — everything the project is, survives**                                              | Must-have |                                       |
| R1.1   | Content items of every kind, including archived ones, with their body                           | Must-have | Archive hides, it does not discard    |
| R1.2   | Canvas layouts — window rects, groups, workspaces, camera                                       | Must-have | Plan 1173 "framework snapshot"        |
| R1.3   | Relations with their `kind` and `label`                                                         | Must-have | Schema `relates_to`                   |
| R1.4   | Saved views                                                                                     | Must-have | `savedViews` table                    |
| R1.5   | Project identity and title                                                                      | Must-have | Plan: project is the unit             |
| **R2** | **Round trip — an export can become an equivalent project again**                               | Must-have | Plan 1173 "migration path"            |
| R2.1   | Record ids either survive or remap without collision                                            | Must-have |                                       |
| R2.2   | Import does not produce false revision conflicts                                                | Must-have | Plan 1214, revision guard             |
| R2.3   | Restoring over a project is distinguishable from importing beside one                           | Undecided |                                       |
| **R3** | **Openness — the file is useful without this application**                                      | Must-have | "full open-data backup"               |
| R3.1   | A person can read it in a text editor and find their writing                                    | Must-have | Plan 1173 "open-data"                 |
| R3.2   | Note bodies are recoverable as Markdown, not only as editor state                               | Must-have | **Plan 1174, its own Core row**       |
| R3.3   | The file states its own format version before anything else                                     | Must-have | Migration path                        |
| **R4** | **Export is an external action and is treated as one**                                          | Must-have | **Plan 581**                          |
| R4.1   | Approval for destination and payload before bytes leave                                         | Must-have | Plan 581                              |
| R4.2   | A durable external-action receipt records what left                                             | Must-have | Plan 581, 583                         |
| R4.3   | An agent caller cannot export a whole project without the person agreeing                       | Must-have | Plan 581 + ROADMAP WebMCP item        |
| **R5** | **Failure is survivable and legible**                                                           | Must-have | Plan 785, 1232                        |
| R5.1   | A failed import leaves a placeholder stating the reason, with retry or remove                   | Must-have | Plan 785                              |
| R5.2   | A partial import never corrupts records that were already there                                 | Must-have | Plan 1232                             |
| R5.3   | Import shows a durable placeholder or explicit rejection within 100 ms                          | Must-have | Plan 753                              |
| **R6** | **The framework/product boundary holds**                                                        | Must-have | AGENTS.md                             |
| R6.1   | Canvas state is serialized by the framework, not re-implemented                                 | Must-have | `serializeInfiniteCanvasState` exists |
| R6.2   | Content records stay product-owned                                                              | Must-have | Framework knows no content            |
| R6.3   | Any framework change is generic, or is not made                                                 | Must-have | AGENTS.md hard rule                   |
| **R7** | **Scale — it works on a real project, not a demo**                                              | Must-have | Plan 748 budgets                      |
| R7.1   | Binary content does not force a whole project through one JSON string in memory                 | Undecided | Plan 1423 asset storage unresolved    |
| R7.2   | Holds at the plan's stated working scale of 10,000 content items                                | Must-have | Plan 748                              |
| **R8** | **The delivery mechanism is chosen from a specified workflow, not picked first**                | Must-have | **Plan: Excluded scope**              |
| R8.1   | "Selection of a file backend before the project specifies its owning workflow" is out of scope  | Must-have | Plan 42–44                            |

---

## A: One JSON bundle, downloaded from a published action

_Already built as a spike; uncommitted._

| Part | Mechanism                                                                                   |     Flag     |
| ---- | ------------------------------------------------------------------------------------------- | :----------: |
| A1   | `buildProjectExport(projectId)` reads canvases, content (+archived), relations, saved views |              |
| A2   | Canvas layout taken from the stored `layout` object per canvas                              |              |
| A3   | `JSON.stringify` → Blob → object URL → anchor click                                         |              |
| A4   | Published as app action `project.export`, so palette and agents both get it                 |              |
| A5   | Import                                                                                      | ⚠️ not built |
| A6   | Markdown note bodies                                                                        | ⚠️ not built |
| A7   | Approval and receipt                                                                        | ⚠️ not built |

## B: A container of files — JSON manifest plus Markdown per note

| Part | Mechanism                                                                             |                Flag                |
| ---- | ------------------------------------------------------------------------------------- | :--------------------------------: |
| B1   | Manifest JSON: project, canvases with layout, relations, views, item index            |                                    |
| B2   | One `.md` per note, front-matter carrying id/kind/revision, body from `note-markdown` |                                    |
| B3   | Assets written as files beside the manifest rather than inlined                       |   ⚠️ asset authority unresolved    |
| B4   | Packed as a zip for a single-file hand-off                                            | ⚠️ needs a zip dependency decision |
| B5   | Import reads the manifest first, then resolves files it names                         |                 ⚠️                 |

## C: Restore points, with export as one projection of them

| Part | Mechanism                                                                     | Flag |
| ---- | ----------------------------------------------------------------------------- | :--: |
| C1   | A restore point is a durable in-database snapshot of a project                |  ⚠️  |
| C2   | "Export" writes an existing restore point out; it is not a separate read path |      |
| C3   | Import creates a restore point, then applies it, so failure rolls back        |  ⚠️  |
| C4   | Satisfies Plan 1214 (local backups) and 1173 with one mechanism               |      |
| C5   | Storage cost of keeping snapshots in the same engine                          |  ⚠️  |

## D: Streamed directory write through the File System Access API

| Part | Mechanism                                                                        | Flag |
| ---- | -------------------------------------------------------------------------------- | :--: |
| D1   | `showSaveFilePicker`/`showDirectoryPicker` gives the person the destination      |      |
| D2   | Destination choice _is_ the approval gesture — R4.1 comes free from the platform |      |
| D3   | Records stream out, so no whole-project string in memory                         |      |
| D4   | Chrome-only; the plan requires a stated Firefox/Safari behavior                  |  ⚠️  |
| D5   | Import reads back from the same picker                                           |      |

---

## Fit Check

| Req | Requirement                                                                                 | Status    | A   | B   | C   | D   |
| --- | ------------------------------------------------------------------------------------------- | --------- | --- | --- | --- | --- |
| R0  | A person can get a whole project out of the browser and back in, without Polkadot installed | Core goal | ❌  | ❌  | ❌  | ❌  |
| R1  | Coverage — everything the project is, survives                                              | Must-have | ✅  | ✅  | ✅  | ✅  |
| R2  | Round trip — an export can become an equivalent project again                               | Must-have | ❌  | ❌  | ❌  | ❌  |
| R3  | Openness — the file is useful without this application                                      | Must-have | ❌  | ✅  | ❌  | ❌  |
| R4  | Export is an external action and is treated as one                                          | Must-have | ❌  | ❌  | ❌  | ❌  |
| R5  | Failure is survivable and legible                                                           | Must-have | ❌  | ❌  | ❌  | ❌  |
| R6  | The framework/product boundary holds                                                        | Must-have | ❌  | ❌  | ❌  | ❌  |
| R7  | Scale — it works on a real project, not a demo                                              | Must-have | ❌  | ❌  | ❌  | ✅  |
| R8  | The delivery mechanism is chosen from a specified workflow, not picked first                | Must-have | ❌  | ❌  | ❌  | ❌  |

**Notes**

- **Every shape fails R0**, because R0 includes "and back in" and no shape has a built import. R0 is
  the core goal and nothing satisfies it yet. That is the true state.
- A fails R3 on R3.2: it exports Lexical editor state, not Markdown. Plan 1174 is its own Core row
  and A does not touch it.
- A fails R4 on all three: no approval, no receipt, and it is published to agents. **The ROADMAP's
  open WebMCP item says there is no elicitation mechanism, so R4.3 currently has no mechanism at
  all** — this is a collision between two live documents, not an implementation gap.
- A, B and C fail R7.1: each builds the whole project in memory before writing.
- A fails R6.1: it reads the stored `layout` object directly rather than going through
  `serializeInfiniteCanvasState`, so the framework's own serializer is bypassed.
- B fails R4 and R5 for the same reasons as A; its ✅ on R3 is the only place it clearly leads.
- D is the only shape that satisfies R7, and its R4.1 answer is the strongest — the platform's own
  destination picker _is_ the approval. It fails R8 anyway: picking it now is exactly the "file
  backend chosen before the workflow is specified" the plan excludes.
- Every shape fails R8, which is the sharpest result here. **R8 says the workflow has to be
  specified before the mechanism is chosen, and no shape specifies a workflow.** Until that is
  written, the fit check cannot select a winner — it can only rank sketches.

## What this changes

The spike (A) is not a near-miss to finish. It fails 7 of 9 top-level requirements, and two of
those failures — R4 approval/receipt and R8 workflow-first — are things the plan states in its own
words and the spike walked past.

The next move is not to build B, C or D. It is to specify the owning workflow R8 demands: who
exports, when, to where, and what they do with the file. That is a framing question, and it is the
one the plan reserved.

## Open, and reserved

- **R4.3 has no mechanism.** Export requires approval; WebMCP has no elicitation. Either export is
  not published to agents, or the confirmation policy the ROADMAP already lists as open gets
  decided first. This is the same blocker that holds `deleteProject`.
- **R7.1 depends on unresolved asset storage** (Plan 1423). How image bytes are stored decides
  whether a single-file export is even possible.
- **R2.3** — restore-over versus import-beside — is a product call, not a technical one.

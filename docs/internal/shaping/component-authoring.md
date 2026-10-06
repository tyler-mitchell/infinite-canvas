# Authoring data model

Status: design proposal. The examples below describe target behavior.
Current component contracts and operations are in `packages/infinite-canvas/src/schema.ts`
and `packages/infinite-canvas/src/component.ts`.
The local portfolio uses SurrealDB; the D1 and authentication sections describe proposed integrations.

## Ownership

| Owner | Canonical data | Derived data |
| --- | --- | --- |
| Authentication library | Users, provider accounts, sessions | Authenticated user identity |
| Tenant service | Tenants and memberships | Server-authorized project context |
| Static registries | ArkType schemas, component implementations, queries, commands | Serializable definition catalog |
| Content service | Model-bound records | Record field projections |
| Document service | Instances, properties, slots, references | Parent and dependency indexes |
| Infinite Canvas | Window rects, groups, docking, camera, layout | Frame geometry |
| Headless components | Interaction state and motion | Presence and animated values |
| Publication service | One current public bundle per route | Public delivery response |

No content record stores card size, React components, animation progress, or user credentials.
No component instance stores a copy of its definition or referenced record.

## One static schema language

```ts
import { type } from "arktype";

export const content = type.module({
  Link: { label: "string > 0", href: "string.url" },
  CaseStudy: {
    title: "string > 0",
    summary: "string > 0",
    links: "Link[]",
  },
  CardProps: {
    tone: "'card' | 'sunken' = 'card'",
    density: "'compact' | 'comfortable' = 'comfortable'",
  },
});

type CaseStudy = typeof content.CaseStudy.infer;
```

Models, props, state, commands, transforms, and fragment inputs use static schemas.
ArkType owns recursion, unions, defaults, constraints, input parsing, and inferred types.
Registrations use ArkType directly, including its native input/output JSON Schema conversion.
ArkType already implements Standard Schema; no separate interoperability dependency is required.

`InputContract.fields` contains labels and editor controls indexed by schema JSON Pointer,
such as `/properties/links/items/properties/href`.
It does not repeat required fields, enums, defaults, or validation rules.
Nested objects and lists remain part of the generated recursive JSON Schema.
There is no second custom `Input` language or client-authored schema compiler.

ArkType's default undeclared-key behavior preserves extra fields.
Edits preserve those fields; they do not grant them execution, binding, or publication meaning.
The static registry determines supported props and public field projections.

Definitions are installed from application code. Content tools cannot upload JavaScript,
register React implementations, replace schemas, or grant permissions.
JSON Schema discovery must fail for an unsupported conversion; an empty substitute is invalid.

## Definitions and instances

| Definition | Contract |
| --- | --- |
| `ModelDefinition` | Record fields, display field, keyed lists, references, public field allowlist |
| `ComponentDefinition` | Props, named slots, placement rules, events, state, sizing, supported motion |
| `FragmentInterfaceDefinition` | Public inputs and slots of a reusable composition |
| `TemplateDefinition` | A subtree copied with new IDs at insertion |
| `QueryDefinition` | A named, parameterized record query implemented in trusted code |
| `TransformDefinition` | A named pure JSON transformation implemented in trusted code |
| `CommandDefinition` | A named operation with inputs, outputs, effects, and required permission |
| `DesignSystemDefinition` | Tokens, breakpoints, and motion profiles |

An instance references `{ id, contractVersion }` and stores only its authored overrides.
Schema defaults are generated from the schema, rather than declared again in a defaults map.
The definition's `state.initial` is checked against its state schema.
Slot names, limits, and accepted component IDs are checked at registration.
An empty `accepts` list permits no component children. `maximum: null` permits an unbounded
slot only within the project's document limits. An empty ancestor requirement permits any ancestor.

`placement.root` controls whether a component can become a canvas window.
Slot constraints concern composition. Membership permissions concern authorization.
Editor controls and hidden UI have no security meaning.

## Domain records

```json
{
  "id": "motion-studio",
  "scope": { "tenantId": "tyler", "projectId": "portfolio" },
  "model": { "id": "CaseStudy", "contractVersion": 1 },
  "revision": 0,
  "fields": {
    "title": "Agent-Directed Motion Studio",
    "summary": "Agents author human motion, actors, and cameras in a browser physics scene.",
    "links": [{ "label": "Live project", "href": "https://hyphened-motion.netlify.app" }]
  },
  "createdAt": "2026-09-13T00:00:00.000Z",
  "createdBy": { "kind": "user", "userId": "tyler" },
  "updatedAt": "2026-09-13T00:00:00.000Z",
  "updatedBy": { "kind": "user", "userId": "tyler" }
}
```

This is an example payload with illustrative IDs and timestamps.
`fields` is parsed by the referenced static model schema after the envelope is parsed.
The server supplies scope and authorship from the authenticated request; callers cannot spoof them.
References remain IDs. Expanded records are read results and are never written back as references.

Editable object lists declare a stable `keyField`; list edits address the key, not an array index.
Write paths use keyed selectors, such as `["sections", { "key": "physics" }, "title"]`.
Model list/reference declarations use schema pointers so nested field occurrences remain discoverable.
Scalar arrays can be replaced as complete field values.
Paths cannot change identities, scope, authorship, revisions, prototypes, or undeclared fields.
Every content reference stays within the same tenant and project.

## Composition

```json
{
  "roots": ["project-card"],
  "nodes": {
    "project-card": {
      "id": "project-card",
      "kind": "component",
      "component": { "id": "Card", "contractVersion": 1 },
      "props": { "tone": { "kind": "literal", "value": "card" } },
      "events": {},
      "slots": { "header": ["project-title"], "body": ["project-summary"], "footer": [] }
    },
    "project-title": {
      "id": "project-title",
      "kind": "component",
      "component": { "id": "Title", "contractVersion": 1 },
      "props": {
        "text": {
          "kind": "binding",
          "source": {
            "kind": "record",
            "record": { "recordId": "motion-studio", "model": { "id": "CaseStudy", "contractVersion": 1 } }
          },
          "path": ["title"]
        }
      },
      "events": {},
      "slots": {}
    },
    "project-summary": {
      "id": "project-summary",
      "kind": "component",
      "component": { "id": "Prose", "contractVersion": 1 },
      "props": {
        "text": {
          "kind": "binding",
          "source": {
            "kind": "record",
            "record": { "recordId": "motion-studio", "model": { "id": "CaseStudy", "contractVersion": 1 } }
          },
          "path": ["summary"]
        }
      },
      "events": {},
      "slots": {}
    }
  }
}
```

The example assumes the named components are registered with these contracts.
All component children occur in `slots`; props never contain component nodes.
Each node occurs exactly once, either in `roots` or in one parent's slot.
Map keys equal node IDs. Every node is reachable, every child exists, and containment is acyclic.
Parent indexes are derived, never separately authored.

`roots` defines document reading order. Canvas groups define spatial arrangement.
Moving a child between header and footer changes composition.
Dragging a card, docking it, or changing its grid position changes the canvas document.
Reparenting between a root and a slot changes both structures in one document mutation.

## Shared fragments, templates, and repeats

| Operation | Result |
| --- | --- |
| Edit a record | All bindings to its fields observe the new record |
| Edit a fragment document | Linked instances observe its new composition |
| Set a fragment instance input | Only that instance changes |
| Insert a template | A complete independent subtree with new IDs |
| Detach a fragment | An independent copy of its current authored composition |

Fragment interfaces come from the static catalog.
A fragment document maps public slot names to internal node slots.
Omitting an instance slot uses the fragment's default children; an explicit empty slot clears it.
Shared-fragment references are separate aggregate links and cannot form cycles.
The owned-node traversal follows slots. Dependency traversal follows fragment and record references.

A repeat owns one template root in `slots.item` and optional `slots.empty` content.
Each item requires a unique, non-null stable key; array indices are not valid keys.
Runtime identity is `NodeAddress`, including ordered fragment and repeat instance steps.
These steps distinguish repeated copies without inventing saved nodes for each result.
Editing a repeated template changes every copy; editing a record changes that item's facts.
Repeat templates cannot contain canvas roots in this phase; repeated content stays inside a root window.

## Value resolution

Resolution order:

1. Read the current definition and authored property.
2. Select the active responsive override, if any.
3. Resolve the selected source in its record, fragment-input, repeat, state, or context scope.
4. Run a registered pure transform if requested.
5. Apply an explicit fallback only for an absent readable value.
6. Parse the resolved props through the component's schema, including its defaults.
7. Render registered components and their resolved slots.

Overrides use ascending minimum-width breakpoints; the highest matching breakpoint wins.
Equal thresholds, duplicate override IDs, and unknown breakpoint IDs are errors.
Breakpoints use the containing root's width; viewport dimensions remain a distinct binding source.
Only definition-declared responsive properties accept overrides.
An omitted responsive base uses the schema default. Removing the base preserves other overrides.

Absent, null, false, zero, and an empty string are distinct values.
Fallbacks never hide authorization failures, invalid types, query failures, or broken definitions.
Pending queries retain their pending state. Required unresolved props produce a diagnostic surface.
`PropertyInspection` reports the authored value, effective value, origin chain, and authorized edit targets.
Resolved values and inspection responses are never accepted as authored documents.

State bindings can address the current node or an ancestor in the same resolved instance scope.
They cannot reach siblings or other repeated instances by guessing IDs.
Input bindings refer to the nearest fragment interface; item bindings name their enclosing repeat.
The viewer context exposes only authenticated/editable flags, never account credentials or profile claims.
Registered queries receive server-resolved project scope and permissions.
Bindings and commands contain no executable strings or arbitrary HTTP requests.

## Events and motion

Each named component event can invoke one registered command.
Components emit schema-checked JSON payloads; event bindings can read that payload inside the invocation.
DOM event objects are not stored. Event sources are unavailable in ordinary property bindings.
The command owns any ordered multi-step behavior and its failure contract.
Authored content cannot create a general code or workflow interpreter.
View commands change local state; authoring commands use the authorized mutation service.
An agent inherits its authenticated user's permissions and cannot self-assign its actor identity.

Disclosure `open` state is local interaction state. It is never inferred from card height.
Explicit triggers invoke the disclosure command. Ordinary body clicks retain their normal meaning.
Expand in Place trades summary/detail space; Container Transform stays in its local host;
Nested Unfold reveals a nested composition with stable child identities.
Registered components own these behaviors through the shared headless motion components.

Legend State owns reactive runtime state and measurement signals.
Motion owns animated values, velocity, and interruption continuity.
Natural target content is measured at the intended width and under the authored sizing constraint.
Only changed targets reach Infinite Canvas; animated intermediate heights never feed the layout solver.
Font, content, width, and disclosure changes invalidate target measurements.
Reduced motion changes presentation while retaining the same logical final state.

## Infinite Canvas boundary

`CanvasDocument.snapshot` uses `InfiniteCanvasSerializedState<"component">` through the framework parser.
This opaque boundary deliberately prevents a second handwritten geometry schema.
Document replacement must use the native parser; component discovery never exports it as a prop schema.

Each authored root owns one window with the same ID. Descendant nodes own no windows.
Groups, windows, docking, rects, and camera state remain in the native snapshot.
The sizing map records content constraints, not a second copy of window width, height, or grid cells.
Saved rects can restore the last layout while fresh intrinsic measurements arrive.

Use existing public `setGroupChildLayouts` and `setWindowRect` affordances for target geometry.
Canvas mutations preserve root identity and composition; arbitrary window membership changes are refused.
Pointer and layout changes become one authoring save when the interaction settles.
Closing an authored root is a document operation; temporarily hiding a view does not delete content.

Design the composition model, registry, discovery, resolution, and structural edits for Infinite Canvas.
Polkadot Board is the first consumer used to prove that shared capability.
Generic nodes, slots, references, and edit operations carry no portfolio-specific fields.
Tenant/project envelopes wrap those generic contracts at the application boundary.
Portfolio content schemas, auth providers, publication policy, and D1 storage remain application concerns.
Connect the first working consumer before moving code into the shared package.
Extend the existing window registry and command path where their contracts support the capability.
Add shared affordances only where that consumer establishes a concrete gap.

## Mutations and concurrency

```json
{
  "kind": "document.edit",
  "mutationId": "edit-project-title",
  "scope": { "tenantId": "tyler", "projectId": "portfolio" },
  "documentId": "home",
  "expectedRevision": 7,
  "edits": [{
    "kind": "prop.setLiteral",
    "target": { "nodeId": "project-title", "prop": "text", "breakpointId": null },
    "value": "Motion Studio",
    "replaceBinding": true
  }]
}
```

The example intentionally replaces the instance binding.
Changing the shared project title uses `record.edit` against the record's own revision.
`replaceBinding: false` refuses a literal write over an existing bound/derived source.
An override edit affects one breakpoint; `breakpointId: null` addresses the base value.
Unsetting a property restores schema-default behavior. Unsetting an override restores its base.

One mutation targets one aggregate. Its edits apply in order to a candidate, then commit atomically.
A board's composition and canvas snapshot are one aggregate.
Independent record and document edits have independent revision checks.
There is no cross-aggregate best-effort batch disguised as one atomic operation.

The server authenticates, authorizes scope, parses input, loads the aggregate and dependencies,
checks revisions, applies edits, validates the complete candidate, and commits with compare-and-swap.
Dependency existence, scope, and current contract versions must still hold at commit time.
The storage owner returns a conflict when a dependency changes before commit.
The response includes canonical changed content and dependency invalidations.
Clients accept only newer revisions and update the same reactive store used by every view.

Deletion removes an owned subtree; external inbound references refuse deletion.
Duplication remaps every owned ID and internal reference while preserving external record links.
Fragment detachment checks the expected fragment revision and reports its new ID map.
Moving into a descendant, crossing documents implicitly, or leaving a required slot empty is refused.

Mutation IDs make an uncertain network retry identifiable.
A bounded receipt stores the request digest and applied revision, without document snapshots.
Reusing an ID with a different request is refused. A replay returns the current aggregate separately
from the original applied revision. These receipts are not an undo log or a version-history system.

## Tenant and publication boundaries

| Role | Scope |
| --- | --- |
| Owner | Tenant, membership, project, content, layout, and publication management |
| Admin | Project, content, layout, and publication management |
| Editor | Read and edit content, composition, and layout |
| Viewer | Read authorized draft content |

Roles apply within one tenant. Last-owner removal is refused.
An authentication provider account maps to a stable application user ID.
GitHub, Google, and Apple tokens and sessions belong to the maintained auth integration.
Email and provider display names are never ownership keys.
Sites publication settings and application tenant permissions are separate controls.
Every query, record reference, asset read, and mutation checks server-resolved scope.
Unauthorized resource inspection uses the same not-found response as a missing resource.

Public visitors read `Publication.bundle`, not draft records or draft documents.
Publication captures a closed, public projection of the board and all required shared dependencies.
Only model-declared public fields enter the bundle; private dependencies refuse publication.
Publication materializes authoring queries; private or runtime-dependent inputs prevent publication.
Public rendering never evaluates a query against draft storage.
Draft edits cannot change the current public bundle. One current bundle replaces the prior bundle;
there is no retained publication history in this phase.

Publication is a product data contract here. No deployment or release is authorized during local work.

## D1 storage mapping

| Table | Key and stored value | Required constraints |
| --- | --- | --- |
| `tenants` | `id`, name, slug, created time | Unique slug |
| Auth-owned tables | Users, accounts, sessions | Maintained auth integration owns schema |
| `memberships` | `(tenant_id, user_id)`, role | Tenant/user foreign keys; unique membership |
| `projects` | `(tenant_id, id)`, settings and revision | Tenant FK; tenant-unique slug |
| `content_records` | `(tenant_id, project_id, id)`, model ref, revision, JSON fields, authorship | Scoped project FK; valid JSON |
| `documents` | `(tenant_id, project_id, id)`, kind, revision, JSON composition/canvas/interface, authorship | Scoped project FK; valid JSON |
| `assets` | `(tenant_id, project_id, id)`, metadata and storage key | Scoped project FK; no binary payload in D1 |
| `reference_uses` | Source scope, source record/document, path, target | Scoped source/target FKs; exactly one target kind |
| `publications` | `(tenant_id, project_id, document_id)`, path, source revisions, public bundle | Scoped document FK; unique project route |
| `mutation_receipts` | `(tenant_id, project_id, mutation_id)`, digest, actor, applied revision, expiry | Scoped project FK; bounded retention |

Reference indexes are derived from committed content, not client-authored facts.
Store separate nullable record/document/asset target columns with an exactly-one check,
so SQLite can enforce the appropriate scoped foreign key.
Maintain the aggregate, reference index, and receipt in the same D1 transaction.
A stale compare-and-swap must prevent every associated index/receipt write.
Use D1 prepared statements and its native batch transaction; do not assume a zero-row update throws.
The conditional commit implementation remains a required storage integration task.
Generate actual migrations from the selected auth schema and Drizzle definitions during implementation.
No migrations, remote data changes, or hosted resources are created by this contract.

## Structural acceptance

Schema parsing proves shape. The document service must additionally enforce:

- Unique IDs, one parent per node, complete reachability, and no containment/reference cycles.
- Available current definitions, valid props/defaults, legal slots and ancestors, and valid event commands.
- Valid keyed lists, repeat keys, fragment interfaces, source scopes, and binding output types.
- Tenant-scoped references and authorized reads without private data in diagnostics.
- One native window per root and no child windows or duplicated geometry authority.
- Finite configurable limits for document size, depth, node count, references, and mutation length.
- Atomic conflict behavior, safe retries, and preservation of unrelated fields and valid state.
- Published content isolated from draft edits and private fields.
- Effective-value inspection that identifies the actual editable source.

## Integration sequence

1. Register one real case-study schema and Card, Title, Prose, Link, and disclosure compounds.
2. Replace the flat widget model with separate records and a composition document.
3. Route local UI and WebMCP through one candidate-validation and commit path.
4. Connect intrinsic target measurement and the three headless disclosure modes to /board.
5. Exercise shared fragments, repeats, responsive overrides, and conflict recovery when validation is allowed.
6. Add the selected D1/auth runtime after the local product path is coherent.

The proposal describes additional structures whose runtime implementations remain open work.
Passing a schema parser would not prove motion, rendering, persistence, isolation, or interaction quality.

## Sources

- Supplied Builder research, pinned to `5fbee7dec7e2547838e19cda216b35e3662b777e`.
- [Builder inputs](https://github.com/BuilderIO/builder/blob/5fbee7dec7e2547838e19cda216b35e3662b777e/packages/sdks/src/types/input.ts).
- [Builder component contracts](https://github.com/BuilderIO/builder/blob/5fbee7dec7e2547838e19cda216b35e3662b777e/packages/sdks/src/types/components.ts).
- [Builder containment traversal](https://github.com/BuilderIO/builder/blob/5fbee7dec7e2547838e19cda216b35e3662b777e/packages/sdks/src/helpers/find-block.ts).
- [Standard Schema and Standard JSON Schema](https://standardschema.dev/).
- Installed ArkType standard interfaces and the Infinite Canvas serialized-state parser.

Borrowed patterns: shared schemas, definition/instance separation, explicit reuse, and inspectable origins.
Local decisions: static registries, slots-only component containment, typed references, named commands,
separate delivery projections, one-aggregate mutations, and a framework-owned canvas document.

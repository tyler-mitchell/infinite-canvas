> Provenance: copied 2026-06-10 from kek-monorepo
> (`apps/web/reference/infinite-canvas/INFINITE_CANVAS_FEATURE_CATALOGUE_2026.md`,
> authored 2026-04-24). A feature-first survey of the infinite-canvas product
> landscape; use for roadmap positioning and prioritization context. Survey
> facts reflect the products as of early 2026.

# Infinite Canvas Software Feature Catalogue

## Best-effort sweep of current modern / emergent products (feature-first, implementation-light)

_Last updated: 2026-04-24_

## Scope

This document catalogs **canvas-facing features** across current infinite-canvas products and close relatives.

Included:

- canvas objects and primitives
- spatial organization
- navigation and presentation affordances
- connection systems
- mixed-media / embed behavior
- automation or AI that directly changes the canvas
- unusual canvas-native workflows

Explicitly excluded:

- auth, provisioning, admin, permissions
- pricing and plan gating
- sync / storage / serialization / APIs
- multiplayer infrastructure details
- security / compliance
- implementation details unless they explain a user-visible canvas capability

Also note:

- Some products are **truly boundless** canvases.
- Some are **very large visual workspaces** that behave like infinite canvases in practice.
- This is a **best-effort survey**, not a claim that every niche or internal tool on earth is covered.

## What actually differentiates infinite-canvas products now

The differentiators are no longer “can pan + zoom” or “has sticky notes.” The strongest current products distinguish themselves with one or more of these:

1. **Structured spatial containers**  
   Frames, sections, groups, boxes, lists, columns, or sub-boards that make huge canvases navigable.

2. **Navigation layers**  
   Minimap, zoom cues, paths, frames, guided follow mode, quick-jump, presentation mode.

3. **Mixed-media objects**  
   PDFs, videos, audio, links, web pages, bookmarks, embeds, code blocks, tables, diagrams, and files that behave like first-class canvas objects.

4. **Organization automation**  
   Auto-layout, smart grouping, tidy-up tools, clustering, gap snapping, fit-to-content, card spacing, AI summarization of messy boards.

5. **Hybrid structured + freeform modes**  
   Tables, Kanban, timelines, mind maps, wireframes, spreadsheets, maps, and docs living inside the same canvas substrate.

6. **Doc ↔ canvas fusion**  
   The most interesting PKM tools do not treat canvas as a dead-end whiteboard; they let documents and canvas elements transform into one another.

7. **Nested canvases / reusable subspaces**  
   Boards inside boards, nested canvases, reusable cards, cross-board references.

8. **Domain-native primitives**  
   Geospatial objects in map canvases, spreadsheet cells in infinite spreadsheets, stylus-first diagramming in notebook-style canvases.

## Cross-product feature inventory

| Feature family                       | What it is                                                                                     | Representative products                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Spatial containers                   | Frames, sections, boxes, groups, columns, lists, or regions that structure a giant board       | tldraw, FigJam, Figma Design, Miro, Lucidspark, Whimsical, Confluence Whiteboards, Milanote, Kinopio |
| Nested canvases / boards-in-boards   | A canvas can contain another canvas or board                                                   | Muse, Obsidian Canvas, DeepNotes, Heptabase                                                          |
| Mixed-media cards / objects          | Images, PDFs, video, audio, files, websites, embeds, link previews, bookmarks                  | Freeform, tldraw, Obsidian Canvas, Muse, Kinopio, Zoom Whiteboard, Canva Whiteboards                 |
| Smart connectors                     | Shape binding, labeled arrows, elbow routing, obstacle avoidance, connection-to-group behavior | tldraw, Excalidraw, Whimsical, Lucidspark, Freeform, Felt                                            |
| Structured objects inside the canvas | Mind maps, tables, Kanban, timelines, code blocks, wireframes, user cards, equations           | FigJam, Miro, Lucidspark, Zoom Whiteboard, Whimsical, Penpot, Quadratic                              |
| Presentation / guided navigation     | Frames, paths, slide regions, Talktracks, Follow mode, minimap, zoom indicators                | Miro, Lucidspark, Microsoft Whiteboard, Goodnotes Whiteboard, Kinopio, Endless Paper, Concepts       |
| Auto-organization tools              | Tidy up, auto-layout, cluster, space-out, fit-to-content, smart grouping, search               | Heptabase, Mural, Lucidspark, Whimsical, Excalidraw, tldraw, Confluence Whiteboards                  |
| Canvas AI generation                 | AI directly creates or organizes board content                                                 | Miro, Mural, FigJam, Whimsical, Zoom Whiteboard, Creately, Lucidspark, Kosmik                        |
| Spatial knowledge tools              | Backlinks, reusable cards, links between spaces, document nodes on canvas                      | Heptabase, Obsidian Canvas, AFFiNE, Kinopio, Scrintal                                                |
| Stylus-first canvas interaction      | Handwriting, sketching, write-first / shape-later flows, brush-heavy canvases                  | Freeform, Goodnotes Whiteboard, Concepts, Endless Paper, Muse, Defter Notes                          |
| Moodboard-native behaviors           | Asset search, clipping, tagging, browser capture, video keyframes                              | Kosmik, Milanote, Kinopio, Concepts                                                                  |
| Domain-native canvases               | Specialized infinite spaces for maps, spreadsheets, or design systems                          | Felt, Quadratic, Figma Design, Penpot                                                                |

## Product catalogue

## A. Whiteboard-first / general visual collaboration canvases

### tldraw

**Archetype:** programmable whiteboard / general-purpose canvas system.

**Canvas-facing features**

- Standard shape set includes geo shapes, freehand drawing, arrows, lines, text, sticky notes, images, videos, frames, bookmarks, and live embeds.
- Rich text works in text objects and shape labels.
- Arrows can bind to shapes and use straight, curved, or elbow routing, with labels and multiple arrowhead styles.
- Frames act as spatial containers and clip their contents.
- URLs can become bookmark previews or live embeds instead of staying plain text.
- Board editing includes alignment, distribution, and stacking operations.

**Worth stealing**

- **Bookmark + embed behavior** makes the canvas feel like a spatial browser, not just a drawing board.
- **Arrow binding + route variety** is unusually polished for a whiteboard product.
- **Frames as clip regions** are more useful than “visual grouping only.”

### Excalidraw

**Archetype:** sketch-style whiteboard / diagram canvas.

**Canvas-facing features**

- Hand-drawn visual style for shapes, text, arrows, and freehand drawing.
- Elbow arrows support orthogonal routing and shape avoidance.
- Search can find text on the canvas.
- Canvas elements can link to other content.
- Images can be cropped directly on the canvas.
- Mermaid can be pasted directly onto the canvas and turned into a diagram.
- Command palette accelerates board operations.
- Presentation tooling turns board regions into slides / presentation flow.

**Worth stealing**

- **Mermaid paste-to-canvas** is an excellent bridge between text-first and visual-first workflows.
- **Obstacle-avoiding elbow arrows** are a meaningful upgrade over basic connectors.
- **Search across a messy board** matters more than many tools admit.

### FigJam

**Archetype:** workshop / whiteboard canvas with structured collaboration objects.

**Canvas-facing features**

- Core objects include text, shapes, images, sticky notes, comments, sections, and tables.
- Built-in mind maps create structured branching content directly on the board.
- Code blocks let technical content live naturally on a whiteboard.
- Stamps, emotes, and stickers make feedback spatial and lightweight.
- Templates, widgets, plugins, and community assets expand the board beyond stickies.
- Media and links can appear with live previews.
- Timer and voting are built into the board workflow.
- AI actions can generate diagrams, templates, images, or edit text on-canvas.

**Worth stealing**

- **Tables + mind maps + code blocks** make FigJam feel like a “structured whiteboard,” not just a sticky-note wall.
- **Widgets and inserts** push the board toward a mini app platform.
- **Social feedback objects** (stamps / emotes) make large workshops feel less rigid.

### Miro

**Archetype:** large-scale innovation workspace / whiteboard platform.

**Canvas-facing features**

- Standard whiteboard surface supports brainstorming, drawing, diagramming, and mind mapping.
- Frames add structure, navigation, export regions, and presentation flow.
- Presentation mode can turn framed board regions into a guided narrative.
- Talktrack records a walkthrough directly on the board, tied to the canvas context.
- Intelligent Canvas introduces structured formats like Docs, Diagrams, Tables, and more on the same board.
- Kanban content can switch between Kanban, table, and timeline views without recreating the underlying work.
- AI can help cluster ideas, summarize changes, and generate or pre-fill board content.

**Worth stealing**

- **Same-canvas structured formats** are one of Miro’s strongest differentiators.
- **Talktrack** is unusually strong because it turns a static board into an explorable recorded explanation.
- **View switching without rebuilding content** is a major idea: a canvas object should be able to change representation.

### Mural

**Archetype:** facilitation-heavy workshop canvas.

**Canvas-facing features**

- Whiteboard surface supports sticky notes, diagrams, images, GIFs, and templates.
- Facilitation layer includes timer, private mode, voting sessions, laser pointer, custom toolbar, and focus mode.
- Summon / guided attention behaviors help presenters control where people look.
- AI can auto-cluster notes, summarize ideas, generate mind maps, and suggest titles.
- Tags and frameworks support more structured workshop boards.

**Worth stealing**

- **Private Mode** is not flashy, but it is one of the most practically useful whiteboard features in the market because it reduces groupthink.
- **Focus mode + facilitation controls** treat the board as a guided session environment, not just a surface.
- Mural’s differentiation is less “object novelty” and more **behavioral control over group use of the board**.

### Lucidspark

**Archetype:** whiteboard with structured planning and facilitation objects.

**Canvas-facing features**

- Universal canvas for brainstorming, mapping, and planning.
- Dynamic mind maps are not just freeform nodes; they are a dedicated object type.
- Dynamic Table brings structured tabular work into the board.
- Frames and Paths provide both spatial grouping and navigation through the board.
- Breakout boards enable sub-boards / smaller work areas.
- Presentation Mode supports guided walkthroughs.
- Visual Activities, voting sessions, and facilitator controls support workshop use.
- Lucid Cards and embedded links bring external work into the board.

**Worth stealing**

- **Paths** are a strong, underrated idea: a board should be able to contain a curated route through itself.
- **Dynamic objects** (mind maps, tables, cards) are more powerful than treating everything as generic rectangles.
- **Breakout boards** point toward “sub-canvases” as a native concept.

### Whimsical

**Archetype:** technical-team whiteboard with diagramming and wireframing fused together.

**Canvas-facing features**

- Boards provide the infinite canvas substrate.
- Specialized modes include flowcharts, diagrams, mind maps, and wireframes.
- Sections add board structure.
- Supports freehand drawing, annotations, comments, and embeds for images and video.
- Text-to-object pasting speeds up turning plain text into diagram structures.
- Templates seed common board types quickly.
- AI can generate flowcharts and mind maps.
- Auto-layout keeps flowcharts readable as they grow.

**Worth stealing**

- **Wireframes + diagrams + mind maps on one substrate** is highly practical.
- **Text-to-object paste** is a very strong low-friction bridge from raw thought to structure.
- **Flowchart auto-layout** matters because diagrams decay fast without it.

### Canva Whiteboards

**Archetype:** presentation / design asset platform extended into infinite canvas.

**Canvas-facing features**

- Infinite space for brainstorming, mind maps, wireframes, mood boards, planning boards, and visual organization.
- Stickies, graphics, shapes, and lines live on the whiteboard.
- Canva’s asset library is available directly on the canvas.
- Templates cover flowcharts, mind maps, wireframes, Kanban, seating plans, mood boards, and more.
- A presentation page can be expanded into a whiteboard for nonlinear exploration.
- Presentation controls tie the whiteboard back into Canva’s slide workflow.

**Worth stealing**

- **Page → whiteboard expansion** is a powerful bridge between linear presentation and nonlinear exploration.
- **Huge asset library directly in-canvas** makes moodboarding and rapid visual ideation much easier than in most whiteboards.

### Apple Freeform

**Archetype:** low-friction mixed-media whiteboard.

**Canvas-facing features**

- Boundless canvas without page-size or layout anxiety.
- Supports photos, drawings, links, documents, PDFs, videos, audio, sticky notes, and other files on one board.
- Finger / stylus drawing works anywhere on the board.
- Library of 700+ shapes plus alignment guides.
- Connector / diagram tools support linked shapes and diagramming.
- Scanned paper documents can be placed and annotated on the board.

**Worth stealing**

- **Any-file board** behavior is one of Freeform’s strongest ideas: the canvas is a real spatial pinboard for many file types.
- Freeform’s strength is not exotic structure; it is **extremely low-friction media placement**.

### Microsoft Whiteboard

**Archetype:** meeting and facilitation whiteboard inside the Microsoft ecosystem.

**Canvas-facing features**

- Brainstorming and workshop templates for common sessions.
- Sticky notes and note grids for rapid idea capture.
- Freeform ink, smart inking, ruler, and ink-to-shape / enhance-shape behaviors.
- Reactions allow lightweight feedback directly on board content.
- Images, documents, links, and online videos can be added to the board.
- Objects can be locked to the canvas.
- Follow mode lets participants follow a presenter’s viewport through the board.

**Worth stealing**

- **Follow** is one of the clearest examples of a board-native presentation/navigation feature.
- **Object locking** is basic but essential on large workshop canvases.

### Confluence Whiteboards

**Archetype:** whiteboard embedded in a knowledge / planning workspace.

**Canvas-facing features**

- Infinite canvas with a dotted-grid background.
- Core toolset includes sticky notes, text, pen, connectors, shapes, stamps, stickers, images, and links.
- Templates are built in.
- Timer, voting, private mode, and hiding other cursors support facilitated sessions.
- Loom video can be recorded from the board context.
- AI can generate similar stickies, group related content, and summarize a whiteboard.

**Worth stealing**

- **Built-in board organization AI** is useful because it directly manipulates board content rather than sitting beside it as a chat panel.
- Confluence whiteboards show that **knowledge workspace + whiteboard** can be tighter than most vendors currently attempt.

### Zoom Whiteboard

**Archetype:** meeting-centric whiteboard that has grown into a surprisingly broad canvas platform.

**Canvas-facing features**

- Infinite digital canvas with pen, lines, text, sticky notes, freehand drawing, and templates.
- AI can generate a multi-frame board from a prompt, a meeting, or even live transcript context.
- AI can draft diagrams from text prompts.
- Personal and organization-wide shape libraries can include cloud icons and custom assets.
- Layers can be shown or hidden for cleaner presentations.
- Supports mind maps, tables, code blocks, LaTeX equations, user cards, and Kanban-like cards.
- Polls, games, voting, private mode, comments, and dynamic board elements increase interactivity.
- Multi-page whiteboards and hierarchical folders organize larger board collections.

**Worth stealing**

- **AI multi-frame board generation** is one of the strongest current examples of AI changing the actual shape of a board.
- **Technical object support** (code blocks, LaTeX, cloud icon libraries, user cards) makes Zoom Whiteboard more versatile than its market reputation suggests.
- **Layers in a whiteboard** are an underused idea outside design tools.

### Creately

**Archetype:** diagramming-heavy visual workspace on an infinite canvas.

**Canvas-facing features**

- Infinite visual canvas for whiteboarding and diagramming.
- Sticky notes, freehand drawing, text, shapes, and connectors cover standard whiteboard use.
- Strong diagramming layer with many diagram types and large shape libraries.
- Context-specific connectors and smart formatting accelerate readable diagrams.
- AI mind map generation can build structured starting points quickly.
- Notes and search can be attached to or used across diagram content.
- Presentation mode supports sharing a board as a narrative.

**Worth stealing**

- **Diagramming semantics on top of an infinite canvas** make Creately stronger than generic whiteboards for structured thinking.
- Creately is worth studying if the goal is **“whiteboard + serious diagrams,” not just “whiteboard + stickies.”**

## B. Design / UI / diagram canvases that behave like infinite workspaces

### Figma Design

**Archetype:** product design canvas (huge visual workspace rather than a literally endless plane).

**Canvas-facing features**

- Pages provide large design canvases for arranging frames, layers, groups, and components.
- Frames are first-class spatial containers for screens, modules, and prototypes.
- Sections group related designs on the canvas.
- Layout guides, grids, and auto layout add structure inside the spatial workspace.
- Grid layout extends auto layout toward more complex responsive arrangements.
- Interactive prototypes are built directly from canvas content.

**Worth stealing**

- **Sections** are a pragmatic way to organize a giant design canvas without turning it into a pure board.
- **Auto layout inside a spatial canvas** is a powerful hybrid: objects can be both spatially placed and internally structured.

### Penpot

**Archetype:** open design canvas spanning whiteboarding, wireframing, and prototyping.

**Canvas-facing features**

- Whiteboarding on a flexible infinite canvas.
- Wireframing and UI design in the same environment.
- User-flow diagrams connect screens and states.
- Prototyping includes interactive links, overlays, animations, and multi-entry journeys.
- Responsive Flex and Grid layouts bring real layout logic into design artifacts.
- Component kits and UX kits support structured wireframe work on-canvas.

**Worth stealing**

- **Whiteboarding + wireframing + prototyping** in one open tool is practically useful.
- Penpot’s differentiator is less “novel board object” and more **continuity from messy idea to structured interface**.

## C. Spatial knowledge / PKM / research canvases

### Obsidian Canvas

**Archetype:** note-native infinite canvas.

**Canvas-facing features**

- Existing notes can be placed on the canvas as cards rather than duplicated into it.
- Cards can embed images, PDFs, videos, audio, interactive webpages, and other canvases.
- Nested canvases are supported.
- Connections can have labels and colors.
- Groups let related cards live together.
- Cards can be narrowed to headings, resized, swapped, or converted between types.
- URLs can create webpage cards, including YouTube embeds.

**Worth stealing**

- **Existing notes as live cards** is much stronger than copy-paste board notes.
- **Nested canvas cards** are a major unlock for complexity management.
- Obsidian Canvas is one of the clearest examples of the board as a **view over knowledge**, not a separate artifact.

### AFFiNE

**Archetype:** doc-and-canvas hybrid workspace.

**Canvas-facing features**

- Edgeless Mode provides the infinite whiteboard surface.
- One-click switching between document view and whiteboard view.
- Paragraphs and blocks can become movable whiteboard elements.
- Visual elements can be converted back into structured blocks in a document.
- Concept-map-like nodes can open into full documents / pages.
- Whiteboard content such as comments, mind maps, and slides can be referenced back into page mode.

**Worth stealing**

- **Document ↔ canvas bidirectionality** is one of the most strategically important ideas in the entire market.
- AFFiNE treats the canvas as **another representation of the same knowledge**, not as a disconnected brainstorm layer.

### Heptabase

**Archetype:** visual thinking and research whiteboard built from reusable cards.

**Canvas-facing features**

- Whiteboards and cards are the core primitives.
- Whiteboards can be nested.
- Sections group cards spatially.
- Mind maps support auto-layout.
- Custom arrows support different styles.
- Spatial automation tools include Card Space-out, Section Auto-grow, Fit-to-content, Tidy Up, and keyboard navigation.
- PDF cards and highlight cards can be dragged directly onto whiteboards.
- Web articles and YouTube captures can become cards and be placed on boards.
- Cards can be reused across multiple whiteboards.
- A card can show where it lives across whiteboards and what nearby relationships it has.

**Worth stealing**

- **Reusable cards across boards** is very strong; most whiteboards duplicate content instead.
- **Spatial automation tools** are unusually thoughtful and directly address whiteboard sprawl.
- **Source highlights as draggable cards** make research canvases much more useful than generic whiteboards.

### Muse

**Archetype:** calm, nested-board spatial thinking tool.

**Canvas-facing features**

- Boards can contain more boards.
- Single canvas can hold writing, scribbles, notes, images, videos, PDFs, web links, and files.
- Inbox on the left edge acts as a staging area for cards.
- Search and quick-jump navigate across boards.
- PDFs can be read and annotated.
- Connections can be created between cards.
- Export can preserve boards as visual artifacts.

**Worth stealing**

- **Inbox pinned to the canvas edge** is a subtle but strong organizational idea.
- **Nested boards over endless zoom** is a deliberate design choice that many canvases should consider.
- Muse is notable for its **intentional restraint**—it chooses clarity over feature maximalism.

### Kinopio

**Archetype:** playful spatial thinking canvas.

**Canvas-facing features**

- Core primitives are cards and connections.
- Boxes keep related items together; lists create vertically ordered groupings and Kanban-like structures.
- Paint Select enables bulk edits across a freeform area.
- Supports comments, card frames, backlinked tags, links between spaces, code blocks, websites, PDFs, images, and rich media.
- Snap-to-grid and minimap help manage space.
- Cards or boxes can become todos.
- Presentation from animated spaces uses the board itself instead of static slide export.

**Worth stealing**

- **Paint Select** is a very strong interaction pattern for spatial editing.
- **Links between spaces + backlinked tags** make the canvas networked rather than isolated.
- **Present from the live space** is a better default than exporting a dead slide deck.

### Milanote

**Archetype:** visual board / moodboard / planning canvas.

**Canvas-facing features**

- Boards combine notes, images, links, videos, sketches, and other visual content.
- Layout is highly moodboard-friendly.
- Web content can be saved into boards quickly.
- Columns can be created side-by-side, then collapsed or expanded.
- Templates accelerate common board setups.

**Worth stealing**

- **Columns on a visual board** are a simple but useful structural primitive.
- Milanote shows the value of a canvas that is **less whiteboard, more editorial / moodboard surface**.

### Scrintal

**Archetype:** visual note-taking / research board with larger document cards.

**Canvas-facing features**

- Cards are the main building block.
- Cards can be short notes or longer documents with images, videos, and PDFs.
- Notes can be clustered and connected visually.
- Backlinks operate across the boarded knowledge space.
- Cards resize freely and can hold more than a sentence or two.
- Templates seed common board patterns.

**Worth stealing**

- **Long-form content cards** are a meaningful differentiator from sticky-note-only canvases.
- Scrintal is useful to study if the goal is **spatial PKM without shrinking everything into tiny nodes**.

### Kosmik

**Archetype:** moodboard / visual research canvas with AI retrieval.

**Canvas-facing features**

- AI search can pull web assets directly into the workspace.
- Search can be narrowed by site.
- Saved content is automatically tagged and categorized by objects, subjects, and colors.
- Built-in browser makes capture and drag-in workflows faster.
- Videos can live on the canvas, and key frames can be captured into reusable board elements.
- Moodboards can be published and shared.

**Worth stealing**

- **AI asset retrieval straight into the board** is one of the clearest modern moodboard-native ideas.
- **Automatic visual tagging** turns a moodboard into a searchable visual library.
- **Video keyframe capture on-canvas** is a great example of medium-specific tooling.

### DeepNotes

**Archetype:** deeply nested note canvas.

**Canvas-facing features**

- Deep page nesting is central to the product.
- Notes are created quickly and manipulated as canvas objects.
- Containers enable nested note structures.
- Notes can be moved, expanded, and colorized.
- Canvas is pitched for mind maps, diagrams, Kanban boards, database diagrams, family trees, flashcards, and cheat sheets.

**Worth stealing**

- **Very deep nesting** as a first-class affordance.
- DeepNotes is useful as a reference for **simple primitives + deep composition**.

### Defter Notes

**Archetype:** handwriting-first spatial notebook.

**Canvas-facing features** _(lightly verified in this pass)_

- Spatial, non-linear note workspace centered on handwriting.
- “Big desk / endless sheets of paper” metaphor for arranging material.
- Geared toward visual thinkers, researchers, and creative knowledge workers.

**Worth stealing**

- Strong emphasis on **handwriting as the primary spatial thinking medium**, not an afterthought.

## D. Sketching / notebook / moodboard canvases

### Goodnotes Whiteboard

**Archetype:** notebook-first app extending into infinite canvas.

**Canvas-facing features**

- Infinite space with endless pan and zoom.
- Subtle dot-grid background helps orient users at different scales.
- Minimap provides high-level board navigation.
- Zoom level indicator gives immediate scale awareness.
- Templates can seed common board types.
- Revamped diagramming is being built for stylus-first behavior.
- Shapes can be attached around existing written content, images, or ink.

**Worth stealing**

- **Minimap + zoom indicator + zoom-aware dot grid** is a thoughtful orientation stack.
- **Write first, shape later** is an important stylus-native diagramming behavior.

### Concepts

**Archetype:** infinite sketching / ideation canvas.

**Canvas-facing features**

- Infinite canvas for sketching and planning.
- Movable artboards exist inside the infinite canvas.
- Vector-raster hybrid strokes keep the board editable and scalable.
- Every stroke remains adjustable.
- Layers support exploratory iteration.
- Grids, line smoothing, live snap, shape guides, scale, and measurement support precise work.
- Images and PDFs can be imported into the canvas.
- Presentation Mode can turn the canvas into a live explanation surface.

**Worth stealing**

- **Artboards inside an infinite canvas** is one of the most practically useful ideas in creative tools.
- **Editable vector strokes** are excellent for exploratory work where ideas change constantly.

### Endless Paper

**Archetype:** minimal, stylus-first infinite canvas for drawing and handwritten thought.

**Canvas-facing features**

- Infinite canvases for handwritten notes, diagrams, visual ideation, and art.
- Bookmarks save important locations on the canvas.
- Bookmark folders organize navigation targets.
- Presentation mode can be built from bookmarks.
- Layers support separation of content.
- Replay is part of the product’s canvas identity.
- Web Experience publishes a zoomable interactive version of a canvas to the web.

**Worth stealing**

- **Bookmarks as first-class navigation + presentation objects** are a major idea.
- **Published zoomable canvases** are a rare and compelling extension of the infinite canvas concept.
- Endless Paper shows how much mileage you can get from a **minimal interface + strong navigation primitives**.

## E. Specialized canvases worth studying

### Felt

**Archetype:** map-native collaborative canvas.

**Canvas-facing features**

- Core visual objects include markers / pins, lines, polygons, routes, notes, and text.
- Annotation tools are map-aware rather than generic whiteboard objects.
- Draw tools include markers, highlighters, circles, lines, and polygons.
- Annotations can be converted into layers for richer map behavior.
- Maps combine annotations with layers and legend-driven exploration.

**Worth stealing**

- Felt is the best example here of **domain-native objects** beating generic shapes.
- If a canvas has a clear domain, the right move is often to make domain objects first-class.

### Quadratic

**Archetype:** infinite spreadsheet canvas.

**Canvas-facing features**

- Spreadsheet grid behaves like an infinite canvas that can be panned and zoomed.
- Data, code, formulas, and charts can coexist spatially on one large sheet.
- Dashboards and analyses can be placed beside source data without “breaking” the layout.
- Infinite-canvas behavior changes how analytical work is organized: work can expand sideways in context instead of forcing everything into one cramped sheet.

**Worth stealing**

- **Spreadsheet + canvas hybrid** is a very different idea from whiteboarding, but it is important.
- Quadratic shows that “infinite canvas” is not just a whiteboard pattern; it can be a **general spatial computing pattern**.

## F. Moodboard / visual collection variants that are still strategically useful

### Milanote vs. Kosmik vs. Kinopio (quick contrast)

- **Milanote** emphasizes editorial / moodboard composition and simple columns.
- **Kosmik** emphasizes AI-powered asset retrieval, tagging, and browser capture.
- **Kinopio** emphasizes playful spatial expression, lightweight PM structures, and live-space presentation.

These three are worth comparing together because they answer the same question differently:  
**What should a modern moodboard / visual collection canvas optimize for—composition, retrieval, or spatial thought?**

## G. Design/whiteboard boundary cases worth keeping in the frame

### Figma Design vs. FigJam vs. Penpot (quick contrast)

- **Figma Design** is strongest for structured product design on a very large canvas.
- **FigJam** is strongest for workshops, planning, and mixed structured/freeform board content.
- **Penpot** is strongest when you want whiteboarding, wireframing, and prototyping continuity in an open stack.

This boundary matters because many “next-generation” canvas products will likely need to borrow from **both** the whiteboard lineage and the design-canvas lineage.

## H. Features that feel especially innovative or strategically important

These deserve extra emphasis because they are not just “more objects.” They change what the canvas can be.

### 1. Doc ↔ canvas bidirectionality

**Seen in:** AFFiNE  
A whiteboard is much more valuable when it is not a dead-end brainstorm layer. The ability to move between structured document blocks and freeform spatial layout is one of the most important current ideas in the market.

### 2. Reusable knowledge objects across multiple boards

**Seen in:** Heptabase, Obsidian Canvas  
Most whiteboards duplicate content. Reusable cards / live note cards are stronger because the board becomes a view over living knowledge.

### 3. Boards inside boards

**Seen in:** Muse, Obsidian Canvas, DeepNotes, Heptabase  
Nested canvases are one of the cleanest answers to infinite-canvas sprawl. They let scale emerge without forcing one massive flat plane.

### 4. Guided navigation as a first-class layer

**Seen in:** Miro, Lucidspark, Microsoft Whiteboard, Goodnotes Whiteboard, Endless Paper  
The minimap, paths, Follow, frames, and bookmark presentations matter because the problem with infinite space is not creation—it is return, orientation, and narration.

### 5. AI that changes the board itself

**Seen in:** Zoom Whiteboard, Miro, Mural, FigJam, Whimsical, Confluence Whiteboards, Creately  
The important AI pattern is not “chat next to the board.” It is AI that generates, groups, summarizes, or restructures board objects directly.

### 6. Structured objects inside freeform space

**Seen in:** FigJam, Miro, Lucidspark, Zoom Whiteboard, Whimsical, Quadratic  
The strongest canvases are no longer made only of generic rectangles and arrows. They mix freeform space with tables, timelines, mind maps, Kanban cards, spreadsheets, code blocks, and more.

### 7. Domain-native canvas primitives

**Seen in:** Felt, Quadratic, Concepts  
Specialized canvases become much more compelling when they stop pretending every problem is a sticky note.

## Short product-by-product “steal list”

If you only want the shortest possible scan, this is the punch list:

- **tldraw:** bookmarks, live embeds, rich text labels, high-quality arrow binding/routing.
- **Excalidraw:** Mermaid paste, obstacle-avoiding elbow arrows, board search, canvas links.
- **FigJam:** sections, tables, mind maps, code blocks, widgets, stamps/emotes.
- **Figma Design:** sections, frames, auto layout inside spatial canvas, interactive prototypes.
- **Miro:** structured board formats, Talktrack, view switching between Kanban/table/timeline.
- **Mural:** private mode, focus mode, facilitation controls, board-organization AI.
- **Lucidspark:** dynamic mind maps, dynamic table, paths, breakout boards.
- **Whimsical:** diagrams + wireframes + mind maps on one substrate, text-to-object paste.
- **Canva Whiteboards:** presentation page → whiteboard expansion, asset library in-canvas.
- **Freeform:** any-file board, connector/diagram support, alignment guides.
- **Microsoft Whiteboard:** Follow, smart inking, note grids, object locking.
- **Confluence Whiteboards:** built-in AI organization, facilitation controls inside a knowledge workspace.
- **Zoom Whiteboard:** AI multi-frame boards, layers, code blocks, LaTeX, user cards.
- **Creately:** serious diagramming semantics on an infinite canvas.
- **Obsidian Canvas:** live note cards, nested canvases, interactive web pages on board.
- **AFFiNE:** document ↔ canvas conversion.
- **Heptabase:** reusable cards, nested whiteboards, tidy-up / space-out / auto-grow tools.
- **Muse:** nested boards, inbox rail, intentional anti-chaos design.
- **Kinopio:** paint select, linked spaces, animated live-space presentations.
- **Milanote:** visual editorial boards with lightweight columns.
- **Scrintal:** larger long-form card documents on a board.
- **Kosmik:** AI asset search, auto-tagging, built-in browser, video keyframes.
- **DeepNotes:** deep nesting with simple note primitives.
- **Defter Notes:** handwriting-first spatial thinking.
- **Goodnotes Whiteboard:** minimap + zoom indicator + stylus-native shape attachment.
- **Concepts:** movable artboards inside infinite canvas, editable vector strokes.
- **Endless Paper:** bookmarks as navigation/presentation, zoomable web-published canvases.
- **Felt:** map-native primitives instead of generic shapes.
- **Quadratic:** infinite spreadsheet spatial layout.
- **Penpot:** whiteboarding → wireframing → prototyping continuity.

## Closing synthesis

If you zoom out across the whole landscape, the strongest modern infinite-canvas products are converging around a few truths:

1. **Plain infinite space is not enough.**  
   The winners add structure without killing freedom.

2. **Navigation is as important as creation.**  
   Big canvases fail when users cannot re-find, present, or reason about what they made.

3. **The canvas is becoming a host for many object types.**  
   The future is not just shapes and stickies; it is mixed structured objects on a freeform plane.

4. **Knowledge canvases are moving beyond duplication.**  
   Reusable cards, live notes, doc↔canvas conversion, and nested canvases are becoming more important.

5. **Specialized canvases are often stronger than generic canvases.**  
   Maps, spreadsheets, stylus notebooks, and moodboards improve when their primitives match the domain.

6. **The most interesting next-generation canvas products will likely be hybrids.**  
   Expect the best new systems to combine:
   - freeform spatial composition
   - structured objects
   - strong navigation/presentation
   - mixed media
   - smart organization
   - some form of nested or reusable content model

## Method note

This sweep was built from live research across official product pages, help centers, support docs, release posts, and app-store/product listings where needed. It intentionally prioritizes **visible user-facing canvas capabilities** over back-end or implementation details.

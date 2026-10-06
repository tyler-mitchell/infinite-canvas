> Provenance: The 2026-06-10 copy came from kek-monorepo.
>
> Source: `apps/web/reference/infinite-canvas/INFINITE_CANVAS_FEATURE_CATALOGUE_2026.md`.
>
> Source date: 2026-04-24. The findings describe the products as of early 2026.

# Infinite canvas feature catalogue

## Scope

This survey records visible canvas features across infinite-canvas and related products. It supports roadmap comparisons and priority decisions.

The survey includes:

- Canvas objects and primitives
- Spatial organization
- Navigation and presentation
- Connection systems
- Mixed media and embeds
- Automation or AI that directly changes the canvas
- Unusual canvas-specific workflows.

The survey excludes:

- Authentication, provisioning, administration, and permissions
- Pricing and plan limits
- Synchronization, storage, serialization, and APIs
- Multiplayer infrastructure
- Security and compliance
- Implementation details without a visible canvas effect.

Some products have a boundless canvas. Other products have a large workspace with similar behavior.

The source set does not cover every product.

## Shared feature groups

The survey found these feature groups:

1. **Spatial containers.** Frames, sections, groups, boxes, lists, columns, and sub-boards divide a large canvas into regions.

2. **Navigation layers.** Minimaps, zoom cues, paths, frames, Follow mode, quick jump, and presentation mode help users navigate a canvas.

3. **Mixed-media objects.** Products place PDFs, video, audio, links, websites, bookmarks, embeds, code blocks, tables, diagrams, and files on the canvas.

4. **Organization automation.** Products provide automatic layout, grouping, spacing, clustering, fit-to-content, search, and AI summaries.

5. **Structured and freeform modes.** Some canvases contain tables, Kanban boards, timelines, mind maps, wireframes, spreadsheets, maps, and documents.

6. **Document and canvas conversion.** Some knowledge tools convert document blocks to canvas objects and back to document blocks.

7. **Nested and reusable content.** Some products support boards inside boards, nested canvases, reusable cards, and references across boards.

8. **Domain objects.** Map canvases have geospatial objects. Infinite spreadsheets have cells. Notebook canvases have stylus tools.

## Cross-product feature inventory

| Feature family                       | What it is                                                                               | Representative products                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Spatial containers                   | Frames, sections, boxes, groups, columns, lists, or regions that structure a giant board | tldraw, FigJam, Figma Design, Miro, Lucidspark, Whimsical, Confluence Whiteboards, Milanote, Kinopio |
| Nested canvases / boards-in-boards   | A canvas can contain another canvas or board                                             | Muse, Obsidian Canvas, DeepNotes, Heptabase                                                          |
| Mixed-media cards / objects          | Images, PDFs, video, audio, files, websites, embeds, link previews, bookmarks            | Freeform, tldraw, Obsidian Canvas, Muse, Kinopio, Zoom Whiteboard, Canva Whiteboards                 |
| Smart connectors                     | Shape binding, labeled arrows, elbow routes, obstacle prevention, and group connections  | tldraw, Excalidraw, Whimsical, Lucidspark, Freeform, Felt                                            |
| Structured objects inside the canvas | Mind maps, tables, Kanban, timelines, code blocks, wireframes, user cards, equations     | FigJam, Miro, Lucidspark, Zoom Whiteboard, Whimsical, Penpot, Quadratic                              |
| Presentation / guided navigation     | Frames, paths, slide regions, Talktracks, Follow mode, minimap, zoom indicators          | Miro, Lucidspark, Microsoft Whiteboard, Goodnotes Whiteboard, Kinopio, Endless Paper, Concepts       |
| Auto-organization tools              | Tidy up, auto-layout, cluster, space-out, fit-to-content, smart grouping, search         | Heptabase, Mural, Lucidspark, Whimsical, Excalidraw, tldraw, Confluence Whiteboards                  |
| Canvas AI generation                 | AI directly creates or organizes board content                                           | Miro, Mural, FigJam, Whimsical, Zoom Whiteboard, Creately, Lucidspark, Kosmik                        |
| Spatial knowledge tools              | Backlinks, reusable cards, links between spaces, document nodes on canvas                | Heptabase, Obsidian Canvas, AFFiNE, Kinopio, Scrintal                                                |
| Stylus-first canvas interaction      | Handwriting, sketching, write-first / shape-later flows, brush-heavy canvases            | Freeform, Goodnotes Whiteboard, Concepts, Endless Paper, Muse, Defter Notes                          |
| Moodboard-native behaviors           | Asset search, clipping, tagging, browser capture, video keyframes                        | Kosmik, Milanote, Kinopio, Concepts                                                                  |
| Domain-native canvases               | Specialized infinite spaces for maps, spreadsheets, or design systems                    | Felt, Quadratic, Figma Design, Penpot                                                                |

## Product catalogue

## Whiteboards and visual collaboration

### tldraw

**Product type:** programmable whiteboard and general canvas system.

**Observed features**

- The shape set includes geo shapes, freehand drawing, arrows, lines, text, sticky notes, images, video, frames, bookmarks, and live embeds.
- Rich text works in text objects and shape labels.
- Arrows bind to shapes and support straight, curved, and elbow routes.
- Arrows also support labels and multiple arrowhead styles.
- Frames contain and clip canvas content.
- A URL can become a bookmark preview or a live embed.
- Alignment, distribution, and stacking commands organize board content.

### Excalidraw

**Product type:** sketch-style whiteboard and diagram canvas.

**Observed features**

- Shapes, text, arrows, and freehand lines use a hand-drawn visual style.
- Elbow arrows support orthogonal routes and shape obstacle prevention.
- Search finds text on the canvas.
- Canvas elements can link to other content.
- Users can crop images on the canvas.
- Pasted Mermaid text becomes a diagram.
- The command palette provides board operations.
- Presentation tools turn board regions into a presentation flow.

### FigJam

**Product type:** workshop whiteboard with structured collaboration objects.

**Observed features**

- The core objects include text, shapes, images, sticky notes, comments, sections, and tables.
- Mind maps create structured branches on the board.
- Code blocks hold technical content.
- Stamps, emotes, and stickers provide spatial feedback.
- Templates, widgets, plugins, and community assets add board content.
- Media and links can appear with live previews.
- The board includes a timer and voting.
- AI actions generate diagrams, templates, and images. They also edit canvas text.

### Miro

**Product type:** large visual workspace and whiteboard platform.

**Observed features**

- The canvas supports brainstorming, drawing, diagrams, and mind maps.
- Frames provide structure, navigation, export regions, and presentation flow.
- Presentation mode gives a route through framed regions.
- Talktrack records a canvas walkthrough with its board context.
- Intelligent Canvas places Docs, Diagrams, Tables, and other structured formats on one board.
- Kanban content can change between Kanban, table, and timeline views without new source content.
- AI clusters ideas, summarizes changes, and creates or fills board content.

### Mural

**Product type:** workshop canvas with facilitation controls.

**Observed features**

- The canvas supports sticky notes, diagrams, images, GIFs, and templates.
- The facilitation controls include a timer, private mode, voting, a laser pointer, a custom toolbar, and focus mode.
- Summon and guided-attention actions control the participant viewport.
- AI clusters notes, summarizes ideas, generates mind maps, and suggests titles.
- Tags and frameworks support more structured workshop boards.

### Lucidspark

**Product type:** whiteboard with structured planning and facilitation objects.

**Observed features**

- The canvas supports brainstorming, mapping, and planning.
- Dynamic mind maps use dedicated structure that differs from freeform nodes.
- Dynamic Table puts tabular work on the board.
- Frames and Paths provide spatial grouping and board navigation.
- Breakout boards create smaller work areas.
- Presentation Mode provides guided board walkthroughs.
- Visual Activities, voting sessions, and facilitator controls support workshop use.
- Lucid Cards and embedded links place external work on the board.

### Whimsical

**Product type:** technical whiteboard with diagrams and wireframes.

**Observed features**

- Boards provide the infinite canvas.
- Specialized modes include flowcharts, diagrams, mind maps, and wireframes.
- Sections divide the board.
- The board supports freehand drawing, annotations, comments, images, and video embeds.
- Pasted text can become diagram objects.
- Templates provide common board structures.
- AI generates flowcharts and mind maps.
- Automatic layout arranges flowcharts as they grow.

### Canva Whiteboards

**Product type:** design and presentation platform with an infinite canvas.

**Observed features**

- The canvas supports brainstorming, mind maps, wireframes, mood boards, planning boards, and visual organization.
- Sticky notes, graphics, shapes, and lines can appear on the whiteboard.
- The Canva asset library is available on the canvas.
- Templates include flowcharts, mind maps, wireframes, Kanban, seating plans, and mood boards.
- A presentation page can expand into a whiteboard for nonlinear work.
- Presentation controls connect the whiteboard to the Canva slide workflow.

### Apple Freeform

**Product type:** mixed-media whiteboard.

**Observed features**

- The canvas has no fixed page size.
- One board supports photos, drawings, links, documents, PDFs, video, audio, sticky notes, and other files.
- Finger and stylus drawing work on the full board.
- The library has more than 700 shapes and alignment guides.
- Connector and diagram tools link shapes and support diagrams.
- Users can place and annotate scanned paper documents on the board.

### Microsoft Whiteboard

**Product type:** meeting and facilitation whiteboard inside the Microsoft ecosystem.

**Observed features**

- Templates support common brainstorming and workshop sessions.
- Sticky notes and note grids support rapid capture.
- The board supports freeform ink, smart inking, a ruler, ink-to-shape, and shape enhancement.
- Reactions provide feedback on board content.
- Users can add images, documents, links, and online video.
- Users can lock objects to the canvas.
- Follow mode shares the presenter viewport with participants.

### Confluence Whiteboards

**Product type:** whiteboard in a knowledge and planning workspace.

**Observed features**

- The infinite canvas has a dotted grid.
- The tools include sticky notes, text, a pen, connectors, shapes, stamps, stickers, images, and links.
- The product includes templates.
- A timer, voting, private mode, and hidden cursors support facilitated sessions.
- Users can record Loom video from the board.
- AI generates similar sticky notes, groups related content, and summarizes a board.

### Zoom Whiteboard

**Product type:** meeting whiteboard and general canvas platform.

**Observed features**

- The infinite canvas has a pen, lines, text, sticky notes, freehand drawing, and templates.
- AI creates a multi-frame board from a prompt, meeting, or live transcript.
- AI creates diagrams from text prompts.
- Personal and organization-wide shape libraries can contain cloud icons and custom assets.
- Layers can show or hide content for a presentation.
- The board supports mind maps, tables, code blocks, LaTeX equations, user cards, and Kanban-like cards.
- Polls, games, voting, private mode, comments, and dynamic objects add interaction.
- Multi-page boards and nested folders organize board collections.

### Creately

**Product type:** diagram workspace on an infinite canvas.

**Observed features**

- The canvas supports whiteboards and diagrams.
- Sticky notes, freehand drawing, text, shapes, and connectors provide standard whiteboard behavior.
- The diagram layer supports many diagram types and large shape libraries.
- Context-specific connectors and smart formatting arrange diagrams.
- AI creates mind maps.
- Notes attach to diagram content, and search finds diagram content.
- Presentation mode gives a route through a board.

## Design and diagram workspaces

### Figma Design

**Product type:** product design workspace on a large canvas.

**Observed features**

- Pages contain frames, layers, groups, and components.
- Frames contain screens, modules, and prototypes.
- Sections group related designs on the canvas.
- Layout guides, grids, and Auto layout add structure.
- Grid layout adds responsive arrangements to Auto layout.
- Interactive prototypes use canvas content.

### Penpot

**Product type:** open design canvas for whiteboards, wireframes, and prototypes.

**Observed features**

- The product includes a flexible infinite whiteboard.
- Wireframes and interface designs use the same environment.
- User-flow diagrams connect screens and states.
- Prototypes support links, overlays, animations, and journeys with multiple entry points.
- Flex and Grid layouts add responsive layout rules.
- Component kits and UX kits support structured wireframe work on-canvas.

## Spatial knowledge and research

### Obsidian Canvas

**Product type:** note-based infinite canvas.

**Observed features**

- Existing notes can appear as cards without duplicate note content.
- Cards can embed images, PDFs, videos, audio, interactive webpages, and other canvases.
- A canvas can contain another canvas.
- Connections support labels and colors.
- Groups contain related cards.
- Cards can show one heading, resize, swap, or convert to another type.
- A URL can create a webpage card or YouTube embed.

### AFFiNE

**Product type:** document and canvas workspace.

**Observed features**

- Edgeless Mode provides the infinite whiteboard surface.
- One action changes between document view and whiteboard view.
- Paragraphs and blocks can become movable whiteboard elements.
- Visual elements can become structured document blocks.
- Concept-map nodes can open full documents or pages.
- Page mode can refer to comments, mind maps, and slides from the whiteboard.

### Heptabase

**Product type:** visual research whiteboard with reusable cards.

**Observed features**

- Whiteboards and cards are the main objects.
- A whiteboard can contain another whiteboard.
- Sections group cards.
- Mind maps support automatic layout.
- Custom arrows support different styles.
- Card Space-out, Section Auto-grow, Fit-to-content, Tidy Up, and keyboard navigation organize content.
- Users can drag PDF cards and highlight cards to a whiteboard.
- Web articles and YouTube captures can become cards and appear on boards.
- One card can appear on multiple whiteboards.
- A card shows its whiteboard locations and nearby relationships.

### Muse

**Product type:** nested-board spatial notebook.

**Observed features**

- A board can contain another board.
- One canvas can hold writing, scribbles, notes, images, video, PDFs, web links, and files.
- An inbox on the left canvas edge stages cards.
- Search and quick jump move across boards.
- Users can read and annotate PDFs.
- Connections link cards.
- Export preserves boards as visual files.

### Kinopio

**Product type:** spatial card canvas.

**Observed features**

- Cards and connections are the main objects.
- Boxes keep related items together. Lists create ordered groups and Kanban-like structures.
- Paint Select applies bulk edits to a freeform area.
- The canvas supports comments, card frames, backlinked tags, linked spaces, code blocks, websites, PDFs, images, and rich media.
- Snap-to-grid and a minimap organize the space.
- A card or box can become a todo.
- Animated spaces provide presentations without a slide export.

### Milanote

**Product type:** visual board for moodboards and planning.

**Observed features**

- Boards combine notes, images, links, videos, sketches, and other visual content.
- The layout supports moodboard composition.
- Users can save web content to a board.
- Side-by-side columns can collapse and expand.
- Templates provide common board structures.

### Scrintal

**Product type:** visual research board with document cards.

**Observed features**

- Cards are the main objects.
- A card can contain a short note or a long document with images, video, and PDFs.
- Users can cluster and connect notes.
- Backlinks connect the knowledge on boards.
- Cards resize and support content longer than a short note.
- Templates provide common board structures.

### Kosmik

**Product type:** visual research canvas with AI search.

**Observed features**

- AI search places web assets in the workspace.
- Search can use a site filter.
- The product applies automatic tags and categories from objects, subjects, and colors.
- A built-in browser supports capture and drag actions.
- Video can remain on the canvas. Users can capture video frames as reusable board objects.
- Users can publish and share moodboards.

### DeepNotes

**Product type:** deeply nested note canvas.

**Observed features**

- Deep page nesting is a main product behavior.
- Users create notes and change them as canvas objects.
- Containers provide nested note structures.
- Users can move, expand, and color notes.
- The product supports mind maps, diagrams, Kanban boards, database diagrams, family trees, flashcards, and cheat sheets.

### Defter Notes

**Product type:** handwriting-first spatial notebook.

Status: lightly observed in this survey.

**Observed features**

- The workspace supports spatial, nonlinear handwritten notes.
- The product uses a large desk and endless paper model.
- The product targets visual thinkers, researchers, and creative knowledge workers.

## Sketching, notebooks, and moodboards

### Goodnotes Whiteboard

**Product type:** notebook application with an infinite canvas.

**Observed features**

- The canvas supports continuous pan and zoom.
- A dot grid provides scale cues.
- A minimap provides board navigation.
- A zoom indicator shows the current scale.
- Templates provide common board structures.
- The planned diagram tools use stylus-first behavior.
- Shapes can attach around existing text, images, or ink.

### Concepts

**Product type:** infinite sketching and planning canvas.

**Observed features**

- The canvas supports sketching and planning.
- Movable artboards exist inside the infinite canvas.
- Hybrid vector and raster strokes remain editable and scalable.
- Users can change each stroke.
- Layers support exploratory changes.
- Grids, line smoothing, live snap, shape guides, scale, and measurement support precise work.
- Users can import images and PDFs.
- Presentation Mode uses the canvas as a live presentation.

### Endless Paper

**Product type:** stylus-first infinite canvas for drawing and handwriting.

**Observed features**

- The canvas supports handwritten notes, diagrams, visual ideas, and art.
- Bookmarks save important locations on the canvas.
- Bookmark folders organize navigation targets.
- Presentation mode uses bookmarks.
- Layers separate content.
- The canvas supports replay.
- Web Experience publishes an interactive zoomable canvas to the web.

## Specialized canvases

### Felt

**Product type:** collaborative map canvas.

**Observed features**

- Map objects include markers, pins, lines, polygons, routes, notes, and text.
- Annotation tools use map-specific behavior.
- Drawing tools include markers, highlighters, circles, lines, and polygons.
- An annotation can become a layer.
- Maps combine annotations, layers, and legends for exploration.

### Quadratic

**Product type:** infinite spreadsheet canvas.

**Observed features**

- The spreadsheet grid supports pan and zoom like an infinite canvas.
- Data, code, formulas, and charts can share one large sheet.
- Dashboards and analyses can remain beside their source data without a layout change.
- Work can expand sideways without a new sheet.

## Moodboard comparison

- Milanote focuses on editorial moodboard composition and columns.
- Kosmik focuses on AI asset retrieval, tags, and browser capture.
- Kinopio focuses on spatial cards, project structures, and live-space presentations.

## Design and whiteboard comparison

- Figma Design supports structured product design on a large canvas.
- FigJam supports workshops, planning, and structured or freeform board content.
- Penpot connects whiteboards, wireframes, and prototypes in an open stack.

## Cross-product findings

### Document and canvas conversion

Observed in: AFFiNE.

The same content can move between structured document blocks and freeform canvas objects.

### Reusable knowledge objects

Observed in: Heptabase, Obsidian Canvas.

One note or card can appear on multiple boards without duplicate source content.

### Nested boards

Observed in: Muse, Obsidian Canvas, DeepNotes, Heptabase.

A board can contain another board. This structure divides a large information space into smaller spaces.

### Guided navigation

Observed in: Miro, Lucidspark, Microsoft Whiteboard, Goodnotes Whiteboard, Endless Paper.

Frames, paths, Follow mode, minimaps, and bookmark presentations provide routes through large canvases.

### AI that changes canvas content

Observed in: Zoom Whiteboard, Miro, Mural, FigJam, Whimsical, Confluence Whiteboards, Creately.

These products use AI to create, group, summarize, or restructure canvas objects.

### Structured objects in freeform space

Observed in: FigJam, Miro, Lucidspark, Zoom Whiteboard, Whimsical, Quadratic.

These canvases contain tables, timelines, mind maps, Kanban cards, spreadsheets, and code blocks.

### Domain objects

Observed in: Felt, Quadratic, Concepts.

Their domain objects include map objects, spreadsheet cells, and editable strokes.

## Method

The original survey examined official product pages, help centers, support docs, release posts, and app-store or product listings.

The survey records visible canvas features. It does not assess back-end or implementation details.

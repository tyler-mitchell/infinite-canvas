import type { PortfolioDocument } from "./model.ts";

export const initialDocument: PortfolioDocument = {
  widgets: [
    {
      id: "profile", kind: "profile", span: 8,
      name: "Tyler Mitchell", role: "Software Engineer",
      summary: "I build typed GPU runtimes, code intelligence for coding agents, and headless UI frameworks in TypeScript.",
      location: "Austin, TX", availability: "Open to full-time roles",
    },
    {
      id: "contact", kind: "contact", span: 4,
      title: "Let’s work together", email: "tyler.davis.mitchell@gmail.com",
      links: [
        { label: "GitHub", href: "https://github.com/tyler-mitchell" },
        { label: "LinkedIn", href: "https://linkedin.com/in/tyler-d" },
        { label: "X", href: "https://x.com/tylerdmitchell" },
      ],
    },
    {
      id: "simulation-engine", kind: "project", span: 7,
      title: "WebGPU Simulation Engine", period: "2026–present", visibility: "Private",
      summary: "A deterministic browser runtime for physics, learning, and generated motion.",
      tags: ["TypeScript", "WebGPU", "WGSL", "TypeGPU", "Effect"], links: [],
      sections: [
        { title: "Typed execution", body: "Fixed-capacity resources and phased operations let a device-independent compiler check access, aliasing, producer order, and phase placement before GPU execution. A timeline records steps and restores recorded positions through replay." },
        { title: "Physics and learning", body: "GPU rigid-body physics combines an AVBD solver, contact generation, runtime joints, and kinematic input. A tensor IR produces forward and reverse GPU programs with memory reuse, Adam, gradient clipping, and checkpoints." },
        { title: "Motion and rendering", body: "A browser motion model generates poses for physics and skinning. Rendering uses cached bundles, indirect and instanced draws, GPU culling, depth pyramids, occlusion, and glTF skin admission." },
      ],
    },
    {
      id: "motion-studio", kind: "project", span: 5,
      title: "Agent-Directed Motion Studio", period: "2026–present", visibility: "Open source",
      summary: "Agents author human motion, actors, and cameras in a browser physics scene.",
      tags: ["TypeScript", "WebGPU", "WebMCP", "SurrealDB"],
      links: [
        { label: "Live project", href: "https://hyphened-motion.netlify.app" },
        { label: "Source", href: "https://github.com/tyler-mitchell/hyphened" },
      ],
      sections: [
        { title: "Shared editing", body: "Agents and people use the same ArkType-validated operations for scenes, stories, actors, obstacles, cameras, and playback. Undo, authorship, and SurrealDB WASM persistence share that operation path." },
        { title: "Generated performance", body: "The simulation engine generates motion on the GPU. Each actor drives a physics body, and GPU forward kinematics produces skin palettes from interpolated poses." },
      ],
    },
    {
      id: "type-atlas", kind: "project", span: 5,
      title: "Code Intelligence for Agents", period: "2026–present", visibility: "Open source",
      summary: "Type Atlas gives coding agents direct access to the TypeScript language service.",
      tags: ["TypeScript", "MCP", "LSP", "Node.js"],
      links: [
        { label: "Package", href: "https://npmjs.com/package/@type-atlas/mcp" },
        { label: "Source", href: "https://github.com/tyler-mitchell/type-atlas" },
      ],
      sections: [
        { title: "Semantic navigation", body: "Definitions, references, callers, and inferred types resolve to real symbols. Natural-language search finds code by behavior across monorepos." },
        { title: "Model-oriented output", body: "Results are labeled and grouped for agent context windows. Bodies fold when signatures are sufficient, and type errors appear with ordinary navigation responses." },
      ],
    },
    {
      id: "infinite-canvas", kind: "project", span: 7,
      title: "Spatial Window Manager", period: "2026–present", visibility: "Open source",
      summary: "A headless React library for opening, focusing, snapping, grouping, and docking windows on an infinite canvas.",
      tags: ["TypeScript", "React", "WebGPU"],
      links: [
        { label: "Package", href: "https://npmjs.com/package/@hyphened/infinite-canvas" },
        { label: "Source", href: "https://github.com/tyler-mitchell/infinite-canvas" },
      ],
      sections: [
        { title: "One command path", body: "Pointer, keyboard, UI, and automation use the same commands. The core consists of pure functions over plain data, with undo and redo at the document boundary." },
        { title: "Layered rendering", body: "DOM windows and optional WebGPU or React Three Fiber scenes share the same camera. This portfolio uses the window manager for its board." },
      ],
    },
    {
      id: "cmd-mesh", kind: "project", span: 6,
      title: "Declarative Command Model", period: "2026–present", visibility: "Open source",
      summary: "One command declaration produces typed functions, a CLI, an MCP server, and a machine-readable specification.",
      tags: ["TypeScript", "MCP", "ArkType", "Effect"],
      links: [{ label: "Source", href: "https://github.com/tyler-mitchell/cmd-mesh" }],
      sections: [{ title: "Shared contracts", body: "ArkType schemas define command inputs. Effect owns runtime and process execution. Help and shell completion come from the same declaration used by people and agents." }],
    },
    {
      id: "package-management", kind: "project", span: 6,
      title: "Programmatic Package Management", period: "2026–present · In development", visibility: "Open source",
      summary: "A common API to install, uninstall, detect, and import packages across npm, Yarn, Bun, and pnpm.",
      tags: ["TypeScript", "Node.js"],
      links: [{ label: "Source", href: "https://github.com/tyler-mitchell/package-management" }],
      sections: [],
    },
    {
      id: "federato", kind: "experience", span: 6,
      organization: "Federato", role: "Founding Frontend Engineer", period: "Dec 2021–Jan 2023",
      summary: "Rebuilt the frontend architecture while delivering the underwriting workbench for the company’s first major customer.",
      tags: ["React", "TypeScript", "GraphQL", "Tailwind", "Turborepo"],
      details: [
        "Established a shared monorepo, TypeScript adoption, stitched GraphQL code generation, and a fragment-based data layer.",
        "Built headless components and feature flags for multi-tenant configuration, and supported the team through mentoring and development standards.",
      ],
    },
    {
      id: "paypal", kind: "experience", span: 6,
      organization: "PayPal", role: "Software Engineer", period: "Jan 2020–Jan 2022",
      summary: "Built account creation and onboarding flows on the Guest & Signup checkout team.",
      tags: ["React", "Redux", "GraphQL", "TypeScript", "Node.js"],
      details: [
        "Delivered passwordless onboarding and integrated Buy Now Pay Later into the guest checkout application.",
        "Contributed developer-experience improvements to the team’s core application.",
      ],
    },
    {
      id: "ut-health", kind: "experience", span: 5,
      organization: "UT Health San Antonio", role: "Software Engineer · Contract", period: "Started 2020",
      summary: "Led development of patient management and surgery scheduling software for clinical teams.",
      tags: ["Express", "GraphQL", "Prisma", "TypeScript", "React"],
      details: ["Owned architecture, design, support, and maintenance, with integrations for Epic, Microsoft Graph, and Qgenda."],
    },
    {
      id: "expertise", kind: "expertise", span: 7, title: "Tools and focus",
      groups: [
        { title: "Core", items: ["TypeScript", "React", "WebGPU / WGSL", "TypeGPU", "React Three Fiber / Three.js", "Node.js", "GraphQL"] },
      { title: "Agent tooling", items: ["MCP / WebMCP", "Codex", "Claude Code", "Effect", "ArkType"] },
        { title: "Applications", items: ["Legend State", "SurrealDB", "PostgreSQL", "Tailwind", "Radix / React Aria", "Docker", "Figma"] },
        { title: "Interests", items: ["Real-time simulation", "Procedural systems", "Game design", "Input ergonomics and hardware"] },
      ],
    },
    {
      id: "education", kind: "education", span: 5,
      degree: "Bachelor of Computer Science", institution: "University of Texas at San Antonio", period: "2017–2020",
    },
  ],
};

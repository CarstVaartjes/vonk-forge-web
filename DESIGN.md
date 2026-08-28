---
name: "Vonk Forge"
description: "An operator-owned local workbench for one Spark or a fleet."
colors:
  forge-ivory: "#f3efe6"
  ash-muted: "#aaa396"
  ash-faint: "#958e80"
  workbench-black: "#0c0b09"
  iron-panel: "#12110e"
  raised-iron: "#191712"
  rule-dark: "#302d26"
  rule-bright: "#49443a"
  action-green: "#8ad52a"
  ready-green: "#b8e978"
  source-ember: "#ff7a1a"
  source-ember-soft: "#ff9e57"
  danger-red: "#ff715e"
typography:
  display:
    fontFamily: "Onest Variable, Helvetica Neue, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(3.5rem, 6.8vw, 6rem)"
    fontWeight: 700
    lineHeight: 0.92
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Onest Variable, Helvetica Neue, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.4rem, 5vw, 4.7rem)"
    fontWeight: 700
    lineHeight: 0.96
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Onest Variable, Helvetica Neue, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.45rem, 2.5vw, 2rem)"
    fontWeight: 700
    letterSpacing: "-0.04em"
  body:
    fontFamily: "Onest Variable, Helvetica Neue, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.7rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.05em"
rounded:
  square: "0"
  tight: "0.2rem"
  control: "0.45rem"
  surface: "0.75rem"
  pill: "999px"
  circle: "50%"
spacing:
  xs: "0.35rem"
  sm: "0.65rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  section: "clamp(5rem, 10vw, 9rem)"
components:
  button-primary:
    backgroundColor: "{colors.action-green}"
    textColor: "{colors.workbench-black}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0.78rem 1.15rem"
    height: "3rem"
  button-primary-hover:
    backgroundColor: "{colors.ready-green}"
    textColor: "{colors.workbench-black}"
    rounded: "{rounded.control}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.forge-ivory}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0.78rem 1.15rem"
    height: "3rem"
  nav-install:
    backgroundColor: "transparent"
    textColor: "{colors.ready-green}"
    rounded: "{rounded.square}"
    padding: "0.55rem 0.8rem"
  workbench-card:
    backgroundColor: "{colors.iron-panel}"
    textColor: "{colors.forge-ivory}"
    rounded: "{rounded.tight}"
    padding: "1.5rem"
  source-row:
    backgroundColor: "{colors.raised-iron}"
    textColor: "{colors.forge-ivory}"
    rounded: "{rounded.square}"
    padding: "1.5rem"
---

# Design System: Vonk Forge

## Overview

**Creative North Star: "The Local Workbench"**

Vonk Forge should feel like one legible workbench for operator-owned infrastructure: a near-black field, high-contrast ivory information, fine rules, and compact system readouts. The atmosphere is technical and controlled without becoming theatrical. Density comes from real relationships and operational facts, while generous section intervals keep the system understandable.

The visual grammar makes ownership visible. Green marks actions, applied state, and infrastructure that is ready inside the operator's boundary. Orange is a deliberately narrow exception for public source and forge heat. Depth is restrained so hierarchy comes primarily from type, alignment, tonal surfaces, and precise borders.

Legacy eyebrows and kickers, thick side-tab borders, generic Unicode icons, and Space Grotesk are not part of this system even if older selectors or screens still contain them. Onest Variable is the self-hosted family and the source of typographic truth.

**Key Characteristics:**

- Near-black workbench surfaces with warm ivory type.
- Bold, tightly set Onest headings and plain-spoken supporting copy.
- Green for action, private readiness, and confirmed local state.
- Orange only for public source and forge heat.
- Fine one-pixel rules, mostly square containers, and restrained depth.
- Real operational structure instead of decorative infrastructure imagery.

## Colors

The palette is a warm industrial dark system with one functional green voice and one tightly bounded ember exception.

### Primary

- **Action Green** (`action-green`): Drives primary installation actions, selected local navigation, and ready-state markers.
- **Ready Green** (`ready-green`): Carries readable green text, hover states, command text, and confirmed local status on dark surfaces.

### Secondary

- **Source Ember** (`source-ember`): Marks public-source provenance and moments of forge heat; it is not a second call-to-action color.
- **Soft Ember** (`source-ember-soft`): Provides readable source labels and restrained heat highlights against the workbench ground.

### Neutral

- **Workbench Black** (`workbench-black`): The uninterrupted page ground and deepest controller surface.
- **Iron Panel** (`iron-panel`): The default card and operational-row surface.
- **Raised Iron** (`raised-iron`): A small tonal step for selected or exceptional rows.
- **Forge Ivory** (`forge-ivory`): Primary headings, high-priority values, and strong labels.
- **Ash Muted** (`ash-muted`): Supporting copy and secondary navigation.
- **Ash Faint** (`ash-faint`): Metadata that remains useful but should recede.
- **Dark Rule** (`rule-dark`): Default one-pixel division between regions.
- **Bright Rule** (`rule-bright`): Focused boundaries and secondary-control strokes.
- **Danger Red** (`danger-red`): Error state only; never decoration.

### Named Rules

**The Ownership Color Rule.** Green means the action or state belongs to the operator's local system. Orange means public source or forge heat. Do not swap these roles or let both compete in one control.

**The Ivory Hierarchy Rule.** Keep large type warm ivory; create supporting hierarchy by moving through ash tones rather than lowering opacity unpredictably.

## Typography

**Display Font:** Onest Variable (with Helvetica Neue, UI sans-serif, and system sans-serif fallbacks)
**Body Font:** Onest Variable (with Helvetica Neue, UI sans-serif, and system sans-serif fallbacks)
**Label/Mono Font:** UI monospace (with SFMono-Regular, Menlo, and monospace fallbacks)

**Character:** Onest makes the system direct, dense, and contemporary without giving it a generic developer-tool voice. Bold headings compress into decisive blocks; neutral body text stays highly readable. Monospace is reserved for commands, numeric sequence, and machine-facing metadata.

### Hierarchy

- **Display** (700, `display`, 0.92 line-height): One decisive product or section definition with tight wrapping and no decorative preamble.
- **Headline** (700, `headline`, 0.96 line-height): Major section statements, balanced into compact blocks.
- **Title** (700, `title`): Operational stages, cards, and system choices.
- **Body** (400, `body`): Explanations and interface guidance; keep long copy near 65–68 characters per line.
- **Label** (700, `label`, uppercase only where the implementation uses column or terminal metadata): Commands, row indices, table labels, and state metadata.

### Named Rules

**The Definition First Rule.** A large heading should state what the product or section is; do not precede it with an eyebrow, kicker, or category slogan.

**The One Family Rule.** Onest Variable owns both display and body roles. Do not reintroduce Space Grotesk or use a novelty display face to manufacture personality.

## Layout

The site sits in a centered maximum-width work area (1220px) with fluid horizontal gutters (`clamp(2rem, 5vw, 5rem)`). Pages use strong two-column relationships for definition plus evidence, heading plus explanation, or choice plus choice. One-pixel borders frequently complete the grid, so adjacent modules read as a connected system rather than floating cards.

Spacing follows a compact 1rem base rhythm inside components, with 1.5–2rem internal padding for primary structures and `section` spacing between major regions. The layout can be information-dense, but every dense block needs a clear alignment axis and a dominant reading order.

At 1040px, evidence-heavy two-column compositions stack. At 720px, paired headings, paths, and choices resolve to one column and secondary table data may collapse. At 480px, controls become full-width, complex previews simplify, and card grids become a single reading stream. The system remains usable at 320px.

**The Connected Grid Rule.** Prefer shared rules and one-pixel gaps over isolated floating tiles; related items should visibly belong to one operating system.

## Elevation & Depth

The system is flat by default. Tonal changes and crisp one-pixel boundaries carry most depth; the background may hold an extremely restrained heat atmosphere. Shadows are reserved for a primary evidence surface or a high-value action, never applied to every card.

### Shadow Vocabulary

- **Evidence Lift** (`0 2.2rem 5rem rgb(0 0 0 / 38%)`): Grounds a large controller or system preview above the workbench.
- **Action Heat** (`0 0.85rem 2.5rem rgb(84 135 18 / 18%)`): A quiet green lift under the principal local action.

### Named Rules

**The Flat Workbench Rule.** Ordinary content surfaces remain flat. Add a shadow only when a control or evidence panel must cross a clear interaction or narrative plane.

## Shapes

The form language is rectilinear and precise. Connected content regions use square corners; embedded controller views use a barely softened tight corner (`tight`), and ordinary controls use a compact functional radius (`control`). Larger surface rounding (`surface`) belongs to legacy pages and should not spread into new workbench structures. Circular geometry is reserved for status dots and the established forge mark.

Borders are one pixel. Do not create thick side tabs, decorative rails, or oversized pills as substitutes for hierarchy. Clipping should reinforce a contained tool surface, not add ornamental silhouettes.

**The Tool, Not Toy Rule.** Round only what benefits touch or status recognition; keep the system's main structures square and aligned.

## Components

Components feel firm, precise, and ready for real operation.

### Buttons

- **Shape:** Compact functional corners (`control`) with a one-pixel stroke and a 3rem minimum height.
- **Primary:** Action Green with Workbench Black text, strong weight, and `0.78rem 1.15rem` padding.
- **Hover / Focus:** Shift to Ready Green and lift by 2px on hover. Use a clearly visible green focus ring; reduced-motion mode removes the movement.
- **Secondary:** Transparent with Forge Ivory text and a Bright Rule border; hover raises the surface by one subtle tonal step.

### Chips

- **Style:** Status is a small green dot plus plain text or a compact outlined label, not a decorative pill.
- **State:** Ready and applied use green; source provenance uses ember; status text must always accompany color.

### Cards / Containers

- **Corner Style:** Square for connected grids; `tight` only for a self-contained tool preview.
- **Background:** Iron Panel at rest, Raised Iron for selected or exceptional rows.
- **Shadow Strategy:** Flat by default; only the principal evidence surface uses Evidence Lift.
- **Border:** One-pixel Dark Rule, raised to Bright Rule or a quiet green-tinted boundary when state matters.
- **Internal Padding:** 1.5rem by default, rising to 2rem for major choice surfaces.

### Navigation

Navigation is compact Onest text on the workbench ground. Default links use Ash Muted and become Forge Ivory on hover. The installation action is the one persistent green-outlined exception. Mobile navigation wraps into a scannable row without icons or a novelty menu glyph.

### Command Strip

A command strip is a square, one-pixel green-bounded surface. Its environment label is small neutral metadata; the command itself uses the monospace role in Ready Green and scrolls horizontally rather than wrapping into an invalid command.

### Controller Preview

The controller preview is the signature evidence component: a tight rectangular window, explicit local-authority label, one connected internal grid, green applied/connected states, and restrained Evidence Lift. It must look like a plausible operator surface, not dashboard decoration.

## Do's and Don'ts

### Do:

- **Do** use Onest Variable for all display and body hierarchy.
- **Do** make local actions and ready private state green, with a text label alongside any status dot.
- **Do** use orange only to identify public source or controlled forge heat.
- **Do** join related cards with shared one-pixel rules and consistent alignment.
- **Do** preserve 320px usability, visible focus, and reduced-motion behavior.
- **Do** show real operational structures, commands, ownership labels, and states.

### Don't:

- **Don't** make a recipe catalog, recipe grid, or generic feature mosaic the default visual identity.
- **Don't** place legacy eyebrows or kickers above primary definitions.
- **Don't** reintroduce Space Grotesk; Onest Variable is canonical.
- **Don't** use thick side-tab borders, generic Unicode icons, or ornamental pills.
- **Don't** turn orange into a general action color or let it compete with green.
- **Don't** apply large radii and shadows to every surface; the workbench is flat and precise.

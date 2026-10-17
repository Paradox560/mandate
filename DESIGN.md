---
name: Mandate
description: A precise investment workspace with evidence beside every paper-order decision.
colors:
  canvas: "#f3f5f7"
  panel: "#ffffff"
  graphite: "#181d24"
  secondary: "#66717d"
  divider: "#e5e9ed"
  accent: "#006b61"
  accent-hover: "#00554d"
  positive: "#007363"
  negative: "#b73d49"
  soft-accent: "#e6f2ef"
  shell: "#e9edf0"
  chart-grid: "#dce4e8"
  chart-fill: "#eef7f4"
typography:
  headline:
    fontFamily: '"Geist", ui-sans-serif, system-ui, sans-serif'
    fontSize: "clamp(34px, 2.6vw, 40px)"
    fontWeight: 540
    lineHeight: 1.15
    letterSpacing: "-1.4px"
  body:
    fontFamily: '"Geist", ui-sans-serif, system-ui, sans-serif'
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: '"Geist", ui-sans-serif, system-ui, sans-serif'
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.3
  measurement:
    fontFamily: '"Geist", ui-sans-serif, system-ui, sans-serif'
    fontSize: "clamp(38px, 3.2vw, 46px)"
    fontWeight: 480
    lineHeight: 1.15
    letterSpacing: "-1.7px"
  code:
    fontFamily: '"SFMono-Regular", Consolas, monospace'
rounded:
  badge: "7px"
  control: "12px"
  core: "20px"
  shell: "27px"
  pill: "999px"
spacing:
  bezel: "6px"
  inline: "10px"
  sm: "12px"
  md: "18px"
  lg: "24px"
  xl: "36px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.panel}"
    rounded: "{rounded.pill}"
    padding: "11px 18px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "#3f5059"
    rounded: "{rounded.pill}"
    padding: "11px 18px"
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.control}"
    padding: "11px 14px"
  panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.core}"
  panel-shell:
    backgroundColor: "{colors.shell}"
    rounded: "{rounded.shell}"
    padding: "{spacing.bezel}"
---

# Design System: Mandate

## Overview

A precise investment workspace: a floating graphite rail anchors a silver working surface, large tabular balances and an asymmetric review area. Source evidence and permission decisions stay close to the work they support. The Soft Structuralism direction uses tone, measured depth and clear type hierarchy to make a dense financial tool easier to scan.

This record is extracted from the current implementation in `app/globals.css` and `app/use-panel-motion.ts`. It describes the implemented system, not a visual or accessibility score. See [the refinement record](docs/UI-REFINEMENT.md) for scope decisions and verification status.

## Colors

Deep teal carries primary actions, chart marks and deliberate emphasis. Silver and white distinguish the workspace, shell and content surfaces. Graphite anchors navigation and text. Positive and negative states combine semantic color with written status and reasons. Secondary text remains neutral rather than inheriting the accent. Frontmatter contains the normative palette values.

## Typography

Geist is shipped locally as an unmodified variable WOFF2 with `font-display: swap`; the system stack remains the fallback. Body text is 15px with optical sizing. Page headings and portfolio balances have separate responsive scales and weights. Money and quantities use tabular **sans-serif** numerals; code, trace identifiers and preformatted data retain a monospace face. Supporting labels are generally 12px and above, with explicit compact-layout exceptions in the stylesheet.

## Layout

The desktop rail is 216px wide, inset 12px from the viewport; main content begins at a 244px offset. The top bar is 84px high. Main content is capped at 1760px and uses 23px top, 36px right and 24px left padding. The overview pairs a flexible market area with a 342px permission column. The wide-screen permission column increases to 375px.

Responsive stages are 1600px, 1320px, 1100px, 980px, 800px and 600px. At 1100px the tablet rail narrows to 72px. At 800px the overview stacks into one column. At 600px navigation becomes a 264px off-canvas panel, the main offset disappears and content uses 18px horizontal padding. Tables scroll within their own regions when needed. Preserve headings, simulation labels and review order when adapting a surface.

## Elevation & Depth

Major overview surfaces use a lightly toned outer shell with a 6px inset and a white inner surface. The shell radius is 27px; its nested core computes to 21px. Standalone panels use the 20px core radius. Soft ambient shadows and inset highlights create depth without a heavy border grid. The rail, toast and evidence drawer use stronger separation appropriate to their position. Exact shadow and motion values are recorded in the sidecar.

## Shapes

Pill-shaped primary and secondary actions contrast with rounded rectangular fields and data panels. Nested surfaces use concentric radii derived from their padding. Status badges remain compact rounded rectangles; identity avatars and icon containers are circular. Keep the same shape for the same action role across views.

## Components

Buttons use a 43px base minimum height, 13px text and an immediate press scale. Trailing action icons can sit in their own circular surface. Fields use a 44px minimum height, 12px corners and an inset stroke. Navigation uses a light active surface against the graphite rail. Badges always expose a written status. Keyboard focus uses a 3px outline with a 4px offset; chart inspection adds its own focus treatment.

The evidence drawer enters and leaves along the right edge. Its interruptible spring uses stiffness 420 and damping 41, approximately critical damping for unit mass. The drag handle captures the pointer and passes release velocity into settling. Escape, backdrop dismissal and the close button share the same dismissal path. The drawer and mobile navigation contain focus, lock background scrolling and restore focus after closing.

The chart supports pointer inspection, Arrow keys, Home/End and Escape, with a polite textual value readout. Selection controls expose pressed states. Pending feedback stays visible while work runs; errors persist until dismissed. Reduced motion removes positional animation and makes the spring settle immediately. Reduced transparency removes overlay blur; increased contrast strengthens secondary text and surface boundaries.

## Do's and Don'ts

- Do keep historical-source dates and synthetic-market labels visible.
- Do emphasize balances, order decisions and source evidence through type and placement.
- Do use tabular sans-serif numerals for financial data and monospace for actual code/identifiers.
- Do preserve focus, pointer/keyboard parity and reduced-motion/transparency behavior.
- Don't hide permission reasons behind an unexplained score.
- Don't add delayed marketing reveals, decorative finance imagery or invented performance.
- Don't apply the marketing-page taste diagnostic as an automatic dashboard pass/fail gate; inspect each relevant finding in context.

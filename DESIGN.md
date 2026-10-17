---
name: Mandate
description: A calm portfolio blotter for evidence-linked paper-order review.
colors:
  canvas: "#f6f5f1"
  panel: "#ffffff"
  rail: "#202522"
  ink: "#222923"
  secondary: "#626a64"
  divider: "#dedfd8"
  accent: "#d65332"
  accent-hover: "#ba4328"
  positive: "#287054"
  negative: "#b74238"
typography:
  headline:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "29px"
    fontWeight: 550
    lineHeight: 1.25
    letterSpacing: "-1px"
  body:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "10px"
    fontWeight: 500
  measurement:
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
    fontSize: "30px"
    fontWeight: 500
    letterSpacing: "-1.2px"
rounded:
  badge: "4px"
  control: "6px"
  panel: "9px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.panel}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "#4e584c"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "9px 11px"
  panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
---

# Design System: Mandate

## Overview

A calm portfolio blotter: a graphite navigation rail frames an ivory working surface, precise tables and visible order checks. The interface serves small investment teams reviewing evidence and authorization. Charts show the simulation; citation drawers expose historical disclosures. This refresh records the implemented CSS rather than the earlier provisional radius values.

## Colors

Burnt orange marks primary actions and keyboard focus. Graphite, ivory and white separate navigation, workspace and panels. Secondary text uses neutral gray. Green and red express positive and negative states alongside explicit text; neither color alone communicates permission. Token values above come from `app/globals.css`.

## Typography

The UI uses the declared Inter/system sans-serif stack; Inter is not assumed to be downloaded. Monospace numerals align money, quantities and timestamps. The base body is 14px, while dense tables and metadata use smaller roles. Headings are compact with modest negative tracking. Preserve explicit state labels and readable secondary text.

## Layout

A fixed 205px rail and 65px top bar frame the desktop workspace. Main content has 32px vertical and 34px horizontal padding, capped at 1750px. The overview pairs a flexible chart with a 305px decision panel; research and orders use separate review columns. Table regions scroll horizontally when needed.

Responsive breakpoints are 1550px, 1230px, 1020px, 820px and 600px. At 820px the main review columns stack. At 600px navigation becomes an off-canvas drawer and the workspace loses its rail offset. Preserve content order and labels.

## Elevation & Depth

Panels use borders and tone at rest. Shadows are reserved for the toast and evidence drawer; selected orders use an inset indicator. Exact values live in the sidecar. Do not add decorative floating layers to dense tables.

## Shapes

Controls use the control radius, panels the panel radius and badges the badge radius. One-pixel borders define surfaces. Circular avatars and status dots are limited to identity and status cues.

## Components

Primary and secondary buttons share compact padding, a minimum 36px height and 160ms background, color and border transitions. Inputs have a white surface and divider border. Interactive elements show a 2px accent outline with a 3px offset on keyboard focus. Disabled controls use reduced opacity and an unavailable cursor.

Navigation exposes active states through surface, text and icon changes. Status badges combine written status with semantic color. Tables preserve aligned numeric columns. Permission results remain a checklist with reasons; citation drawers carry source dates and links. Mobile navigation transitions last 180ms. Reduced-motion preferences disable animation and transitions.

## Do's and Don'ts

- Do keep synthetic-market and historical-evidence labels visible.
- Do carry monetary values, source links and permission reasons into review surfaces.
- Do preserve keyboard focus, labeled controls and reduced-motion behavior.
- Don't imply live pricing, investment performance or provider verification through decorative status treatments.
- Don't replace permission reasons with an unexplained score.
- Don't add decorative finance imagery or shadows to ordinary data panels.

# Mandate interface refinement

This pass applies the requested `apple-design`, `high-end-visual-design` and `design-taste-frontend` guidance to an investment review workspace. It changes presentation and interaction; the product remains a paper desk with synthetic prices, historical sources and explicit permission decisions.

## Starting point and intent

The reviewed desktop screenshot, `outputs/redesign/before-desktop.png`, showed a coherent workspace but weak separation between headings, monetary values and supporting text. Many labels were approximately 9–11px. Cream surfaces, rust actions and numerous fine borders gave the screen a softer, denser appearance than the intended investment tool.

The refinement makes balances, order decisions and evidence easier to scan. A neutral working surface, a deliberate type hierarchy, tabular sans-serif numbers and tone-separated panels carry the visual identity. The work area remains asymmetric because a large market/research surface and a narrower permission column serve different tasks.

## How the requested skills apply

**Apple design:** prioritize immediate response, continuity, predictable paths and user control. The evidence drawer uses a physical spring that can be interrupted, preserves motion through a drag release and dismisses along its entry axis. Chart inspection must work with keyboard and touch. Mobile navigation must manage focus and dismiss predictably. Press feedback begins immediately; decorative timing must never delay the action. Reduced motion, reduced transparency and stronger contrast preferences retain useful state feedback.

**High-end visual design:** use the skill's **Soft Structuralism** direction and an asymmetric work area: neutral surfaces, clearer typography, softer depth and precise interaction feedback. Adapt its marketing-oriented prescriptions to a working dashboard. Huge section padding, repeating nested frames, universal pill buttons and delayed scroll reveals would obscure dense financial information and slow repeated work. Surface hierarchy and measured depth serve the review task instead.

**Design taste frontend:** the skill explicitly says **“Not for dashboards or app screens.”** Its marketing-page draw, gallery directions and imagery requirements are therefore outside this screen's scope. The relevant review habits are deliberate hierarchy, real content, restrained ornament and inspection of the rendered result. No marketing composition or image quota is imposed on the desk, and no screenshots, scores or customer proof are invented.

## Interaction implementation record

The drawer's [motion hook](../app/use-panel-motion.ts) integrates a unit-mass spring with stiffness **420** and damping **41**, approximately critical damping. It uses `requestAnimationFrame` and transform updates, caps elapsed time and integrates in small steps. A pointer drag retains the current displayed position, uses pointer capture and transfers recent release velocity into settling. Projection determines whether the sheet closes or returns. Reduced-motion preference snaps to the target and is observed for changes while the panel is open.

The [workspace implementation](../app/page.tsx) adds chart Arrow keys, Home/End and Escape, pointer inspection, a polite textual point readout, and pressed states for chart-window, watchlist/positions, research and order selection. Mobile navigation transfers and traps focus, supports Escape, locks background scrolling and restores focus on close. Background regions are inert while an overlay owns interaction. View changes focus the new heading. Pending notifications remain while an operation is busy, and errors remain until dismissed. Exact code and observed behavior should be checked together during QA; this document does not substitute for those checks. Design tokens and component guidance are recorded in [DESIGN.md](../DESIGN.md), with motion, elevation and responsive metadata in the [design sidecar](../.impeccable/design.json).

## Typeface provenance

Geist is self-hosted from the existing, unmodified `geist-latin.woff2` supplied with Next.js. The copied asset is in [public/fonts](../public/fonts/geist-latin.woff2); [OFL.txt](../public/fonts/OFL.txt) and [LICENSE.txt](../public/fonts/LICENSE.txt) accompany it. The official sources are Vercel's [OFL notice](https://raw.githubusercontent.com/vercel/geist-font/main/OFL.txt) and [license file](https://raw.githubusercontent.com/vercel/geist-font/main/LICENSE.txt). Both identify the SIL Open Font License 1.1. The separate Next.js MIT license is not used as the font's license.

Self-hosting makes the selected face an actual shipped asset rather than an assumption about the user's installed fonts. The system fallback remains available during loading. The font is not modified or sold separately.

## Diagnostic interpretation

The marketing-oriented taste diagnostic reported **58 failures and six blur warnings** during this refinement. It did not pass. Reported conflicts included inset shadows, shadow reset declarations, actual code monospace and blur on fixed overlays or reduced-transparency resets. The high-end/Apple direction intentionally uses concentric surfaces, pill actions and functional overlay materials, which conflict with parts of that public-page rule set. These are documented scope choices, not a blanket dismissal of CSS findings. Legibility, overflow, focus, motion preferences and real interaction still require direct review.

## Verification status — October 17, 2026

The refinement verification run passed **all 12 browser checks in 38.8 seconds**, **all 47 unit tests**, and TypeScript checking. The browser suite combines the existing seven desk/workflow checks with five focused interaction checks. The latter cover chart keyboard navigation and its live value readout, Watchlist/Positions pressed state, mobile focus containment and Escape/focus restoration, reduced-motion drawer dismissal, and normal-motion drawer drag, close and reopen with restored scrolling/focus. Those five interaction tests block and assert the absence of `/api/action` mutations.

Screenshots were captured for all six workspace views at **1440px desktop** and **390px mobile**, plus Overview and Research at **768px**. The capture checks found no page overflow or client page errors, confirmed Geist loaded, and found all page headings within two lines at those widths. Visual review included desktop/mobile Overview, mobile Audit, desktop Mandate, and Research, Orders, tablet and Connections views.

After the full suite, final polish fixed desktop close-button visibility, bounded long history/order lists and responsive chart-axis sizing. The three-width screenshot capture was repeated successfully. Four targeted chart/mobile checks passed, followed by three citation/drawer checks after the motion hook's ref-ownership refinement. ESLint and TypeScript checking also passed. The production build is verified separately during publication.

Final review found and fixed stale release velocity after a short drag followed by a stationary hold. Release samples now expire after 100ms and include the release position/time. A new regression covers a 120px drag held for 180ms: the drawer stays open and returns to rest. All four drawer/citation cases passed after this fix. The browser suite now contains 13 checks; the earlier 12-check duration above describes the full run before adding this regression.

The checks establish the listed behaviors and viewports. They do not establish full WCAG conformance, every assistive-technology combination, a numerical visual score or a passing taste-skill diagnostic. Reduced transparency, contrast preferences and any new edge cases remain subject to direct review when affected by changes.

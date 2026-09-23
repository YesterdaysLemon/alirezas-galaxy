---
name: frontend-quality
description: Build, refine, and review web interfaces using Alireza's design preferences, responsive behavior, and browser validation. Use for frontend implementation and visual changes; exclude backend-only work.
---

# Frontend quality

Treat these preferences as defaults. The current brief, supplied reference, and established product take priority; a past project's style is not a universal theme. Read once and reuse while the instructions remain available. Reload only when changed or needed after context loss.

## Establish the baseline

Inspect relevant project instructions, current UI, implementation, assets, and pending changes. Use the existing stack, components, and delivery workflow as context; refactor or replace earlier approaches when the current brief calls for it. Honor requests for thoughts or inspection before editing. For refinements, identify the exact requested axis, spacing, behavior, or region; preserve approved positions and unaffected dimensions. Do not turn alignment work into a redesign.

## Design priorities

- **The interface is the activity.** Open editors onto their canvas, games onto play, and tools onto controls and useful output. Keep the working surface prominent. Add marketing framing only when requested or inherent to the product.
- **Let the experience carry the explanation.** Use concise labels and necessary instructions. For visual experiences, keep controls subordinate to the content. Remove filler and self-description while preserving accessible names, discoverable controls, and useful error states.
- **Honor the reference's visual language.** For recreations, match layout, density, typography, chrome, and interactions. Preserve classic bevels, compact controls, or custom silhouettes when requested; do not automatically modernize them into rounded cards. For new directions, choose a coherent, brief-specific composition rather than imposing a house style. Author the implementation independently.
- **Make the world functional.** When the brief uses a spatial or tactile metaphor, integrate it with navigation and manipulation. Panels, attached details, drag behavior, and transitions should behave consistently. Use supplied assets in the rendered result and verify them. Playful or surreal details belong when they fit the requested experience; they do not authorize extra features.
- **Functionality completes the appearance.** Implement the control's promised interaction and relevant undo, saving, import/export, or touch behavior within the requested scope. Label simulations and placeholders honestly.
- **Performance is part of the feel.** Honor an explicit Three.js choice; do not add 3D by default. For animated/GPU work, bound pixel ratio, scene complexity, effects, and hit testing; reuse resources, pause hidden work, and respect reduced motion. Prefer measured responsiveness to unsupported speed claims.

## Build and verify

Produce a coherent working slice early, then complete the requested scope. Preserve readable typography, keyboard/focus behavior, touch targets, responsive layouts, and relevant loading/error states. Use appropriate supplied or generated imagery without a fixed image quota or mandatory starter.

For visual or interaction changes, use available browser tools to inspect the result and exercise the changed flow, including desktop and narrow layouts when relevant. For a recreation, compare at the reference viewport. Check overflow, clipping, dialogs, assets, and console failures. Scale verification to the change; do not require the user to explicitly request browser QA. Respect a request to skip it, and report any tooling limitation precisely. Run relevant project checks without inventing redundant tests. A successful build alone is not visual validation.

Keep deployment in the existing project pipeline. When VPS deployment is authorized, use the available `vps-operations` skill and Deploy Manager. A frontend request does not itself authorize publication or hosting migration; use OpenAI Sites only when explicitly selected. Report what changed, what was verified, and any material remaining limitation.

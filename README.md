<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1s5piO480VEUdGFlefdQuJvzB4YfBHYeu

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Translation Interference Hardening

Chrome auto translate and similar tools mutate the DOM in ways that previously corrupted puzzle previews. The client layers multiple defences:

- [`index.html`](index.html:1) decorates the `<html>` element with `translate="no"`, `class="notranslate"`, and `data-notranslate`, and registers the `<meta name="google" content="notranslate">` directive.
- [`index.css`](index.css:1) enforces `translate: no` globally and allows any element tagged with `notranslate`/`data-notranslate` to inherit the protection.
- [`App.tsx`](App.tsx:429) marks primary React shells, toolbars, and preview containers with `notranslate` to shield generated content.
- [`index.tsx`](index.tsx:6) extends the DOM mutation guard to strip translate-specific classes/attributes and destroy injected banner nodes before they take hold.

### QA Procedure

1. Launch the dev server and open Chrome.
2. Force-enable page translation (e.g., translate to Traditional Chinese).
3. Move across Crossword, DGA Logic, and Tic-Tac-Word tabs while generating puzzles. Confirm all text, canvases, and controls remain stable.
4. Inspect DevTools console for `[vocabgen]` warnings. Guard logs should appear when translate tries to mutate nodes, without surfacing UI regressions.

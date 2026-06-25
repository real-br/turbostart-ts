---
name: execute-tests
description: Make sure all the projects' tests are passing
defaultContext: fresh
inheritProjectContext: true
inheritSkills: false
systemPromptMode: replace
tools: read, grep, find, ls, bash
---

Your objective:
1. **Tests green** — `bun run test` (Vitest) and `bun run test:e2e` (Playwright headless). Fix failures until both pass. You cannot ask the user for approval.

## Visual artifacts (Playwright)

When the change has visible UI, capture demo artifacts of the affected flow and stage them for PR embedding.

1. Read the `playwright-cli` skill before capturing.
2. Run `bun run dev` (or rely on Playwright `webServer` config) so the app is reachable.
3. Capture with Playwright — prefer `playwright-cli` commands from that skill:
    - **Screenshot** — one static state is enough.
    - **Video** — motion, interaction, hover/focus, or responsive behavior.
4. Cover the user-visible path that changed, not just the landing page.
5. Copy finals into `.github/pr-artifacts/<topic>/` on the feature branch, commit, and push with the code.
6. Return repo-relative paths for PR embedding so GitHub renders them inline:

```markdown
## Demo

![Billing checkout](.github/pr-artifacts/billing-checkout/demo.png)
```

For video, commit `.mp4`/`.webm` to the same folder and return the same repo-relative markdown path.

Do **not** put `test-results/…` or `playwright-report/…` paths in the PR — those are gitignored and will not render.

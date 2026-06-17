#!/usr/bin/env bash
set -euo pipefail

install_skills() {
  local source="$1"
  shift
  local skills=("$@")

  echo "Installing ${source} -- ${skills[*]}"
  bunx skills add "$source" \
    --skill "${skills[@]}" \
    --agent universal \
    --copy \
    -y
}

# -------------------------------------------------------------------
# Vercel: React, Next.js, AI SDK, UI, browser verification, deployment
# Source: https://vercel.com/docs/agent-resources/skills
# -------------------------------------------------------------------

install_skills vercel-labs/agent-skills \
  vercel-react-best-practices \
  vercel-composition-patterns \
  web-design-guidelines \
  deploy-to-vercel
install_skills vercel-labs/next-skills \
  next-best-practices \
  next-cache-components \
  next-upgrade

install_skills vercel/ai ai-sdk
install_skills vercel/ai-elements ai-elements
install_skills vercel/streamdown streamdown

install_skills vercel/components.build building-components
install_skills vercel/vercel vercel-cli
install_skills vercel-labs/skills find-skills

# -------------------------------------------------------------------
# Frontend / design system
# -------------------------------------------------------------------

install_skills shadcn/ui shadcn

# -------------------------------------------------------------------
# Auth
# -------------------------------------------------------------------

install_skills clerk/skills \
  clerk-nextjs-patterns \
  clerk-setup \
  clerk-backend-api

# -------------------------------------------------------------------
# Durable background jobs
# -------------------------------------------------------------------

install_skills inngest/inngest-skills \
  inngest-durable-functions \
  inngest-events \
  inngest-steps

# -------------------------------------------------------------------
# Integrations
# -------------------------------------------------------------------

install_skills nangohq/skills \
  building-nango-functions \
  building-nango-functions-locally \
  nango-toolbox

# -------------------------------------------------------------------
# Analytics / observability / quality
# -------------------------------------------------------------------

install_skills posthog/posthog-for-claude posthog-instrumentation
install_skills getsentry/skills \
  find-bugs \
  security-review

# -------------------------------------------------------------------
# Database
# -------------------------------------------------------------------

install_skills giuseppe-trisciuoglio/developer-kit drizzle-orm-patterns
install_skills neondatabase/agent-skills claimable-postgres

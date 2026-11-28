# typescript-template

A template for apps that run on Cloudflare Workers and keep their data in D1. Follow `masseater-style`, a skill in masseater/skills that says which skills to load in each situation. `vp install` puts the skills in `.agents/skills/`.

## Tech stack

The base stack is TypeScript 7, Effect, Alchemy and Cloudflare.

## Commands

- `vp run verify` runs every check. The pre-push hook and the Stop hook run the same verify.
- To release the template, bump `version` in the root `package.json` in a PR, merge it, and dispatch the `publish` workflow with the workspace `.`.

## Rules

- ARCHITECTURE.md says which way dependencies may point. Read a workspace's AGENTS.md, if it has one, before changing that workspace. Update ARCHITECTURE.md only when workspace or layer boundaries or invariants change.

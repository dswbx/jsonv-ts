# SPEC_NEXT: JSON Schema Suite Gap Plan

## Summary

Current suite status from `bun run src/test/spec/run.ts`: 2,098 total, 1,549 passed, 458 skipped, 91 optional-format failures, 0 required failures. Skips overlap, but the main skipped buckets are `$ref` 237, `$defs` 172, `unevaluatedProperties` 134, `unevaluatedItems` 71, `dependencies` 36, `vocabulary` 5.

Reference-specific gaps are the priority. With current skips bypassed, `ref.json` only passes 39/79 in relaxed mode; `anchor.json` passes 0/8; `dynamicRef.json` passes 5/44; `refRemote.json` passes 1/31. Most strict failures are caused by `$defs` being rejected before reference evaluation.

## Progress Log

### 2026-06-24 - `f74a6ef feat: improve json schema spec refs`

Implemented and committed the first ref milestone on branch `json-schema-spec`.

Current full-suite status:

- `bun run types`: passed.
- `bun test --bail`: passed, 264 pass, 2 skipped, 0 fail.
- `bun run src/test/spec/run.ts`: passed, 2,098 total, 1,684 passed, 312 skipped, 0 required failures, 102 optional failures.

Bucket status:

| Bucket | Status | Notes |
| --- | --- | --- |
| Bucket 1: local `$ref` and `$defs` | Done for accepted suite scope | `$defs` no longer throws as unsupported; JSON Pointer decoding handles `#`, escaped tokens, percent fragments, and empty tokens; `$ref` validates alongside sibling keywords. `ref.json` is now 78/79 direct, with the remaining case skipped because it depends on annotation/unevaluated behavior. |
| Bucket 2: URI, `$id`, `$anchor` resolver | Done for required anchor/ref cases | Resolver now indexes schemas by resource URI, JSON Pointer, `$id`, `$anchor`, and `$dynamicAnchor`; refs resolve relative to the referring schema. `anchor.json` passes 8/8. Infinite-loop detection passes 2/2. |
| Bucket 3: remote refs | Done for required `refRemote.json` | Added ignored JSON Schema Test Suite `remotes` fixtures and `src/test/spec/remotes.ts` registry. `refRemote.json` passes 31/31. Remote fixtures are fetched by the existing `fetch:spec` script and ignored by git. |
| Bucket 4: `$dynamicRef` | Not done | A minimal `$dynamicRef` path exists, but required `dynamicRef.json` is still intentionally skipped. Direct measurement during implementation was partial only, around 32/44. Needs a dedicated dynamic-scope implementation pass. |
| Bucket 5: remaining skipped buckets | Not done | `unevaluatedItems`, `unevaluatedProperties`, `dependencies`, `vocabulary`, metaschema-only `defs.json`, and optional format precision remain future work. |

Important implementation details:

- `src/lib/validation/resolver.ts` is now the core resolver index. It owns schema metadata and has a static remote registry for test fixtures.
- `src/test/spec/remotes.ts` is the only tracked remotes helper. The actual `src/test/spec/remotes/` JSON files are ignored like `src/test/spec/lib/`.
- `package.json` `fetch:spec` now refreshes both ignored fixture directories: `src/test/spec/lib` and `src/test/spec/remotes`.
- `src/test/spec/run.ts` supports `SPEC_ONLY`, for example:
  - `SPEC_ONLY='ref\.json$|anchor\.json$|refRemote\.json$|dynamicRef\.json$|defs\.json$|infinite-loop-detection\.json$' bun run src/test/spec/run.ts`

Obstacles and lessons:

- Remote fixtures were initially created as untracked files under `src/test/spec/remotes/`. This was corrected by adding that directory to `.gitignore` and moving fixture population into the existing `fetch:spec` script.
- Remote schemas without their own `$id` must use their retrieval URI as the base URI. The resolver registry now sets that when registering a remote schema.
- Nested refs inside remote schemas must validate with the remote document's resolver, not the original caller's resolver. The resolver tracks schema ownership to preserve this.
- The evaluation guard key must be computed from the owning resolver, or unrelated remote roots collapse to the same `#@instance` key and validation can be skipped incorrectly.
- Enabling `$ref` unmasked a non-ref bug: raw-schema `required` arrays were being overwritten by `ObjectSchema`. `ObjectSchema` now preserves explicit `required`.
- The remaining skipped `ref.json` case, "ref creates new scope when adjacent to keywords", is tied to annotation/unevaluated behavior and should be handled with Bucket 5 rather than by special-casing refs.

## How To Record Future Updates

When continuing this work, update this file before or with each commit:

- Add a new dated entry under `Progress Log` with the commit hash and short commit subject.
- Update the bucket table status (`Done`, `Partial`, `Blocked`, or `Not done`) and include exact suite counts for any bucket touched.
- Record commands run and final pass/fail numbers, especially `bun run types`, `bun test --bail`, focused `SPEC_ONLY` runs, and the full spec runner.
- Record obstacles in concrete terms: failing suite file/test description, root cause, and whether the fix was implemented or deferred.
- If skip policy changes in `src/test/spec/run.ts`, note exactly which files/keywords were unskipped or newly skipped and why.
- Keep generated suite fixtures out of git. If new fixtures are needed, add them to `fetch:spec` or another explicit script and update `.gitignore` if necessary.

## Key Changes

- Bucket 1: local `$ref` and `$defs`
  - Stop treating `$defs` as an unsupported validation keyword; it is a schema container, not an assertion.
  - Fix JSON Pointer parsing in `src/lib/utils/path.ts`: support `#`, `#/...`, empty tokens, URI-fragment percent decoding, `~0`, and `~1`.
  - Evaluate `$ref` alongside sibling keywords for draft 2020-12 instead of using `$ref` as an exclusive branch.
  - Target passing local cases in `ref.json`: root pointers, relative pointers, nested refs, boolean-schema refs, escaped pointers, quoted refs, empty-token refs.

- Bucket 2: URI, `$id`, and `$anchor` resolver
  - Replace the current root-only resolver lookup in `src/lib/validation/resolver.ts` with a per-root index of schema resources, canonical URIs, JSON Pointer locations, `$id`, `$anchor`, and `$dynamicAnchor`.
  - Resolve refs relative to the referencing schema's nearest resource URI, not always the root.
  - Change internal resolver calls to pass the referring schema: `resolve(ref, fromSchema)`, while keeping `resolve(ref)` as a root-relative fallback.
  - Support `$anchor` lookup scoped by base URI and make `$id` order-independent.
  - Replace the current simple `ref loop` check with an evaluation guard keyed by resolved schema location plus instance location, so legitimate recursive schemas pass while true cycles do not hang.

- Bucket 3: remote refs
  - Add JSON Schema Test Suite remotes as local fixtures, mapped from `http://localhost:1234/...`; do not use live HTTP in tests.
  - Extend the resolver with an internal remote registry that compiles remote raw schemas lazily through `fromSchema`.
  - Target `refRemote.json` after local URI and anchor support is stable.

- Bucket 4: `$dynamicRef`
  - Add `$dynamicRef` handling after `$anchor` and normal URI resolution are correct.
  - Track dynamic scope during validation so `$dynamicRef` resolves to the nearest matching `$dynamicAnchor` in the active evaluation path.
  - Target required `dynamicRef.json`; leave optional cross-draft behavior for later unless required cases need it.

- Bucket 5: remaining skipped suite buckets
  - After refs, tackle `unevaluatedItems` and `unevaluatedProperties`; these require annotation/evaluated-location tracking across applicators.
  - Then handle legacy `dependencies`, `vocabulary`, and optional format precision separately.

## Interfaces

- Public API: no intentional breaking changes.
- Internal API: `Resolver.resolve(ref: string, from?: Schema): Schema`.
- Internal validation context may gain reference metadata: current schema/resource URI, dynamic scope stack, and visited evaluation keys.
- Schema typings should include `$anchor`, `$dynamicAnchor`, and `$dynamicRef` in internal/base schema options.

## Test Plan

- Add focused unit tests before enabling each suite bucket:
  - JSON Pointer decode: `#`, `#/a~1b`, `#/a~0b`, `#/$defs/foo%22bar`, and empty path segments.
  - `$defs` does not assert or throw by itself.
  - `$ref` plus sibling keywords both validate.
  - `$id` relative resolution uses nearest parent resource.
  - `$anchor` resolves within the correct base URI.
  - Recursive references validate nested data without false loop errors.
  - Remote refs load from local fixture registry.

- Suite iteration commands:
  - `bun test src/lib/utils/path.spec.ts src/lib/ref/ref.spec.ts src/lib/validation/validate.spec.ts --bail`
  - `bun run src/test/spec/run.ts`
  - Add a temporary or committed suite focus mode for `ref.json`, `anchor.json`, `refRemote.json`, and `dynamicRef.json` so each bucket can be measured independently.

- Acceptance targets:
  - Bucket 1 complete when non-URI local `ref.json` cases pass.
  - Bucket 2 complete when `anchor.json` and URI/base-scope `ref.json` cases pass.
  - Bucket 3 complete when `refRemote.json` required cases pass from local fixtures.
  - Bucket 4 complete when required `dynamicRef.json` cases pass.
  - Final ref milestone complete when `$ref`/`$defs` are removed from suite skips without introducing required failures.

## Assumptions

- `SPEC_NEXT.md` should be created at repo root with this plan.
- Draft 2020-12 behavior is the target.
- Remote refs should be deterministic local fixtures, not network fetches during tests.
- Optional format failures are out of scope for the ref milestone.

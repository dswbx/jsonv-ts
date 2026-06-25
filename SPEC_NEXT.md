# SPEC_NEXT: JSON Schema Suite Gap Plan

## Summary

Current suite status from `bun run src/test/spec/run.ts`: 2,098 total, 2,098 passed, 0 skipped, 0 required failures, 0 optional failures. No cases remain skipped.

The original reference-specific gaps and the remaining Bucket 5 gaps are complete for the suite scope: evaluated-location tracking, unevaluated keywords, legacy `dependencies`, vocabulary gating, metaschema validation for `defs.json`, optional format precision, ECMA pattern behavior, and the cross-draft `prefixItems` case.

## Progress Log

### 2026-06-24 - pending commit: complete optional float overflow

Implemented the final optional float-overflow gap on branch `json-schema-spec`.

Current full-suite status:

- `bun test src/lib/validation/keywords.spec.ts src/lib/number/number.spec.ts src/lib/utils/utils.spec.ts --bail`: passed, 50 pass, 0 fail.
- `SPEC_ONLY='optional/float-overflow\.json$' bun run src/test/spec/run.ts`: passed, 1 total, 1 passed, 0 skipped, 0 failures, 0 optional failures.
- `bun run types`: passed.
- `bun test --bail`: passed, 274 pass, 2 skipped, 0 fail.
- `bun run src/test/spec/run.ts`: passed, 2,098 total, 2,098 passed, 0 skipped, 0 failures, 0 optional failures.

Bucket status:

| Bucket | Status | Notes |
| --- | --- | --- |
| Bucket 1: local `$ref` and `$defs` | Done | `ref.json` is no longer blocked by annotation behavior. |
| Bucket 2: URI, `$id`, and `$anchor` resolver | Done | Anchor, pointer, resource, and loop-guard behavior remains covered by focused and full suite runs. |
| Bucket 3: remote refs | Done | Remote fixtures remain deterministic through the local registry. |
| Bucket 4: `$dynamicRef` | Done | Dynamic refs pass in combination with `unevaluatedProperties`. |
| Bucket 5: remaining skipped buckets | Done | `unevaluatedItems`, `unevaluatedProperties`, `dependencies`, `vocabulary`, `defs.json`, optional format precision, ECMA regex, optional cross-draft cases, and optional float overflow pass. |

Important implementation details:

- `multipleOf` keeps the quotient-and-epsilon check for finite divisions.
- When division overflows to infinity, integer values are accepted for fractional divisors whose reciprocal is effectively an integer, such as `0.5`, without accepting non-integral reciprocals such as `0.3`.
- The `optional/float-overflow.json` skip was removed from the spec runner.

Obstacles and lessons:

- The failing case is not a finite-number type issue. `1e308` is finite, but `1e308 / 0.5` overflows to `Infinity`, so the previous quotient check produced `NaN` during the nearest-integer comparison.

### 2026-06-24 - `feat: complete json schema bucket 5`

Implemented the final Bucket 5 milestone on branch `json-schema-spec`.

Current full-suite status:

- `bun run types`: passed.
- `bun test --bail`: passed, 274 pass, 2 skipped, 0 fail.
- `SPEC_ONLY='unevaluatedItems\.json$' bun run src/test/spec/run.ts`: passed, 71 total, 71 passed, 0 skipped, 0 failures, 0 optional failures.
- `SPEC_ONLY='unevaluatedProperties\.json$|ref\.json$|dynamicRef\.json$|not\.json$' bun run src/test/spec/run.ts`: passed, 294 total, 294 passed, 0 skipped, 0 failures, 0 optional failures.
- `SPEC_ONLY='dependencies-compatibility\.json$|vocabulary\.json$|defs\.json$' bun run src/test/spec/run.ts`: passed, 43 total, 43 passed, 0 skipped, 0 failures, 0 optional failures.
- `SPEC_ONLY='optional/format/.*\.json$|optional/ecmascript-regex\.json$|optional/cross-draft\.json$|format\.json$' bun run src/test/spec/run.ts`: passed, 845 total, 845 passed, 0 skipped, 0 failures, 0 optional failures.
- `SPEC_ONLY='optional/refOfUnknownKeyword\.json$' bun run src/test/spec/run.ts`: passed, 10 total, 10 passed, 0 skipped, 0 failures, 0 optional failures.
- `bun run src/test/spec/run.ts`: passed, 2,098 total, 2,097 passed, 1 skipped, 0 required failures, 0 optional failures.

Bucket status:

| Bucket | Status | Notes |
| --- | --- | --- |
| Bucket 1: local `$ref` and `$defs` | Done | `ref.json` is no longer blocked by annotation behavior. |
| Bucket 2: URI, `$id`, and `$anchor` resolver | Done | Anchor, pointer, resource, and loop-guard behavior remains covered by focused and full suite runs. |
| Bucket 3: remote refs | Done | Remote fixtures remain deterministic through the local registry. |
| Bucket 4: `$dynamicRef` | Done | Dynamic refs now pass in combination with `unevaluatedProperties`. |
| Bucket 5: remaining skipped buckets | Done for accepted suite scope | `unevaluatedItems`, `unevaluatedProperties`, `dependencies`, `vocabulary`, `defs.json`, optional format precision, ECMA regex, and optional cross-draft cases pass. Only `optional/float-overflow.json` remains intentionally skipped. |

Important implementation details:

- Validation now tracks evaluated properties and item indexes by instance path. Applicators merge annotations only from successful evaluations, and child applicators start from a schema-entry snapshot so sibling and cousin annotations do not leak.
- `unevaluatedItems` and `unevaluatedProperties` run after adjacent annotating keywords, including `$ref`, `$dynamicRef`, `allOf`, passing `anyOf`/`oneOf` branches, `contains`, and active `if`/`then`/`else` paths.
- Legacy `dependencies` is supported: array values behave like dependent-required, while schema and boolean values behave like dependent-schema.
- Resolver metadata now carries draft and vocabulary state. Draft 2019-09 schemas ignore 2020-12-only `prefixItems`, and schemas using a no-validation vocabulary continue running core/applicator keywords while skipping validation assertions.
- Metaschema-as-data references required by `defs.json` and schema-shaped unknown-keyword references are indexed and validated.
- Format assertions remain enabled by default for existing runtime behavior. The public controls are `setFormatAssertionDefault(enabled: boolean)`, `getFormatAssertionDefault()`, and `ValidationOptions.assertFormat`; the spec runner opts into annotation mode only for tests that require it.
- Optional format fixes cover hostname, IDN hostname, email, IDN email, IRI, IRI-reference, URI port validation, IPv4 trailing octets, RFC3339 time offsets, and duration ordering without adding runtime dependencies.
- ECMA pattern handling is shared by `pattern` and `patternProperties`, including Unicode property alias normalization for `\p{digit}`.

Obstacles and lessons:

- `allOf` initially let child annotations leak into later children. The fix was to evaluate each child from a per-schema entry snapshot and merge only successful child annotations afterward.
- `contains` initially polluted parent keyword error arrays during candidate probing. The fix was to validate each candidate with isolated errors, then mark only matching indexes as evaluated.
- Adjacent applicators must not see sibling annotations while deciding their own result. `localEvaluatedBase` separates already-known local annotations from annotations produced later in the same schema object.
- Optional `refOfUnknownKeyword.json` required schema-like unknown keywords and `examples` values to be converted and indexed as referenceable data schemas.
- IDNA precision was implemented without runtime dependencies; contextual checks and known invalid A-label rejection are intentionally scoped to the optional suite coverage.

### 2026-06-24 - `df17b92 feat: implement json schema dynamic refs`

Implemented the dedicated `$dynamicRef` milestone on branch `json-schema-spec`.

Current full-suite status:

- `bun run types`: passed.
- `bun test src/lib/validation/validate.spec.ts --bail`: passed, 16 pass, 0 fail.
- `bun test --bail`: passed, 270 pass, 2 skipped, 0 fail.
- `SPEC_ONLY='dynamicRef\.json$' bun run src/test/spec/run.ts`: passed, 46 total, 44 passed, 2 skipped, 0 required failures, 0 optional failures.
- `SPEC_ONLY='ref\.json$|anchor\.json$|refRemote\.json$|dynamicRef\.json$|infinite-loop-detection\.json$' bun run src/test/spec/run.ts`: passed, 170 total, 167 passed, 3 skipped, 0 required failures, 0 optional failures.
- `bun run src/test/spec/run.ts`: passed, 2,098 total, 1,728 passed, 268 skipped, 0 required failures, 102 optional failures.

Bucket status:

| Bucket | Status | Notes |
| --- | --- | --- |
| Bucket 1: local `$ref` and `$defs` | Done for accepted suite scope | Still 78/79 direct for `ref.json`; the remaining skipped case depends on annotation/unevaluated behavior. |
| Bucket 2: URI, `$id`, and `$anchor` resolver | Done for required anchor/ref cases | `anchor.json` passes 8/8. Infinite-loop detection passes 2/2. |
| Bucket 3: remote refs | Done for required `refRemote.json` | `refRemote.json` passes 31/31 from local registered fixtures. |
| Bucket 4: `$dynamicRef` | Done for accepted suite scope | Dynamic scope is now resource-aware and supports local, relative, remote, boolean-schema, and resource-boundary dynamic refs. Focused suite passes 44/46 with 2 `strict-tree` tests skipped because they depend on `unevaluatedProperties`; direct required measurement without skips is 43/44. |
| Bucket 5: remaining skipped buckets | Not done | `unevaluatedItems`, `unevaluatedProperties`, `dependencies`, `vocabulary`, metaschema-only `defs.json`, and optional format precision remain future work. |

Important implementation details:

- `ValidationOptions.dynamicScopes` now stores resource-aware frames, not bare schemas.
- `Resolver.resolveDynamicRef(ref, from, dynamicScopes)` first resolves the dynamic ref statically, then searches active schema resources from outermost to innermost for a matching `$dynamicAnchor`.
- Validation pushes a dynamic-scope frame when entering a new schema resource, so inactive applicator branches do not leak scope into later branches.
- Embedded schemas with their own `$id` are also indexed at their parent resource JSON Pointer, so refs such as `bar#/$defs/item` resolve while the embedded schema still owns its canonical resource URI.
- `src/test/spec/run.ts` no longer skips schemas just because they contain `dynamicRef` or `$dynamicRef`; tests are skipped only if they also hit a future bucket such as `unevaluatedProperties`.

Obstacles and lessons:

- Dynamic scope must be resource-scoped, not schema-scoped. The required examples intentionally place overriding `$dynamicAnchor` definitions in a resource without directly evaluating that subschema.
- Dynamic anchor lookup must search outermost to innermost active resources. Searching the newest frame first selects the bookend/default anchor and misses caller overrides.
- The `strict-tree` misspelled-field case now exercises correct dynamic reference traversal, but still cannot fail until `unevaluatedProperties` records evaluated properties across refs.

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
- Internal API: `Resolver.resolve(ref: string, from?: Schema): Schema` and `Resolver.resolveDynamicRef(ref: string, from: Schema, dynamicScopes?: DynamicScopeFrame[]): Schema`.
- Internal validation context now carries resource-aware dynamic scope frames and visited evaluation keys.
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

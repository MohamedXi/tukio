# BMad workflow

Every change is scoped through a **BMad story file**. The BMad framework
provides the slash-command toolkit (`/bmad-create-story`,
`/bmad-dev-story`, `/bmad-code-review`, …) that drives the
plan → implement → review → done loop. Sprint state lives in
`_bmad-output/implementation-artifacts/sprint-status.yaml`.

## Story lifecycle

```
backlog ──/bmad-create-story─→ ready-for-dev ──/bmad-dev-story─→ in-progress ──/bmad-dev-story (completion)─→ review ──/bmad-code-review─→ done
```

| Status          | Meaning                                                          |
| --------------- | ---------------------------------------------------------------- |
| `backlog`       | Story exists only in `epics.md`. No story file yet.              |
| `ready-for-dev` | Story file created with full context, ACs, tasks. Awaiting dev.  |
| `in-progress`   | Dev agent is executing the story. Subtasks checked off as `[x]`. |
| `review`        | All subtasks complete. Awaiting code review.                     |
| `done`          | Review passed. Patches applied. Ready for PR.                    |

Retrospective stories (`epic-X-retrospective`) are `optional` until
completed (`done`).

## Story file layout

Every story lives at
`_bmad-output/implementation-artifacts/<X-Y>-<short-slug>.md` and follows
this structure:

```markdown
# Story X.Y: <Title>

Status: <ready-for-dev | in-progress | review | done>

## Story

**As a** <role>,
**I want** <capability>,
**so that** <outcome>.

> **Outcome attendu** : <concrete success criterion>

## Acceptance Criteria

1. **AC1 — <title>** : Given … When … Then …
2. **AC2 — <title>** : Given … When … Then …
   ...

## Tasks / Subtasks

- [ ] **Task 1 — <description>** (AC: #1)
  - [ ] 1.1 — <subtask>
  - [ ] 1.2 — <subtask>
        ...

## Dev Notes

### <Section> — context for the dev agent

...

### References

...

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Review Findings (AI — <date>)

(populated by /bmad-code-review)

## Change Log

| Date | Change | Author |

## Story Completion Status

- Story Status, Created, Created by, Epic, Sprint, Effort, Dépendances, FRs covered, NFRs touchés
```

## Authorised edits per workflow

**Critical** — `/bmad-dev-story` and `/bmad-code-review` may **only**
modify specific sections of a story file. Never edit other sections
manually mid-workflow.

| Section                                                      | dev-story             | code-review               |
| ------------------------------------------------------------ | --------------------- | ------------------------- |
| Status                                                       | ✅ (final transition) | ✅                        |
| Story (as-a / I-want / so-that)                              | ❌                    | ❌                        |
| Acceptance Criteria                                          | ❌                    | ❌                        |
| Tasks / Subtasks (checkboxes)                                | ✅                    | ✅ (Review Findings only) |
| Dev Notes                                                    | ❌                    | ❌                        |
| Dev Agent Record (model, debug, completion notes, file list) | ✅                    | ❌                        |
| Review Findings                                              | ❌                    | ✅                        |
| Change Log                                                   | ✅ (append)           | ✅ (append)               |
| Story Completion Status                                      | ✅ (status)           | ✅ (status)               |

When a workflow needs a different section edited (e.g. corrected ACs),
escalate via `/bmad-correct-course` — that's the only authorised path.

## Sprint state ledger (`sprint-status.yaml`)

`_bmad-output/implementation-artifacts/sprint-status.yaml` is the
authoritative ledger. Every story has an entry; status transitions are
made by BMad workflows.

Don't hand-edit `sprint-status.yaml` to "fix" inconsistencies without
understanding the root cause — the YAML is downstream of the story
file's `Status:` field and BMad workflows keep them in sync.

If you spot a drift (e.g. story file says `done` but YAML says
`review`), surface it and ask before patching either.

## BMad slash-command toolkit

The full catalogue lives in `.claude/skills/bmad-*`. Highlights:

| Slash                                  | Purpose                                                             |
| -------------------------------------- | ------------------------------------------------------------------- |
| `/bmad-create-story`                   | Create the next story file from the epics + PRD + architecture      |
| `/bmad-dev-story`                      | Implement a story task-by-task; updates story file + sprint-status  |
| `/bmad-code-review`                    | 3-layer adversarial review → triage → apply patches → status `done` |
| `/bmad-create-prd`                     | Author a PRD from scratch (10-step workflow)                        |
| `/bmad-edit-prd`                       | Incremental PRD updates                                             |
| `/bmad-validate-prd`                   | Consistency check                                                   |
| `/bmad-create-architecture`            | Architecture doc + ADRs                                             |
| `/bmad-create-ux-design`               | UX spec from a Cloud Design bundle or scratch                       |
| `/bmad-create-epics-and-stories`       | Break a PRD into epics + stories                                    |
| `/bmad-check-implementation-readiness` | Verdict before starting an epic                                     |
| `/bmad-sprint-planning`                | Plan a sprint from `sprint-status.yaml`                             |
| `/bmad-sprint-status`                  | Summarise current sprint state                                      |
| `/bmad-correct-course`                 | Mid-sprint scope change handling                                    |
| `/bmad-retrospective`                  | Post-epic review                                                    |

## BMad agent personas (`.claude/commands/BMad/agents/`)

10 generic personas (`/dev` James, `/architect` Winston, `/pm` John,
`/po` Sarah, `/qa` Murat, `/sm` Bob, `/analyst` Mary, `/ux-expert` Sally,
`/bmad-master`, `/bmad-orchestrator`). These are **upstream BMad
content** — never edited locally, otherwise the next BMad update wipes
the customisation. Instead, the Tukio-specific guidance lives in
**`.agents/agents/<persona>.md`** (which any session can load on demand)
and in this ACS layout's hard rules.

## Hard rules

- ✅ Every change is scoped through a BMad story file.
- ✅ Use `/bmad-create-story` to create stories; never write story files
  by hand.
- ✅ Respect the authorised-edits table above (per workflow).
- ✅ Story branch names match the story key:
  `feature/story-<X.Y>-<short-slug>`.
- ✅ Sprint-status updates flow through BMad workflows.
- ❌ **Never edit files under `_bmad/`** — upstream framework, wiped on
  update. Customise via `_bmad/custom/<skill>.toml` (team) or
  `.user.toml` (personal).
- ❌ **Never edit `.claude/commands/BMad/agents/*.md`** for the same
  reason. Tukio-specific persona context lives in `.agents/agents/`.
- ❌ **Never edit `.claude/skills/bmad-*`** — upstream.
- ❌ Never skip the `/bmad-code-review` step. The 3-layer adversarial
  review surfaces real bugs (Story 0.10 found 21 patch-worthy issues).
- ❌ Never edit a section the current workflow doesn't authorise. If you
  need to, switch workflow (`/bmad-correct-course`).

# 0006. Enrollment stores `classroomId` so the database allows one Enrollment per Classroom

- Status: accepted
- Date: 2026-11-25

## Context

A Student may have at most one Enrollment per Classroom. An Enrollment only needs `sectionId` (the Section already knows
its Classroom), but then the rule can only be checked in application code, and two join requests racing with Join codes
of different Sections of the same Classroom could both succeed. The project rule is that limits which matter for
fairness are enforced in SQL, not only in code.

## Decision

`Enrollment` stores `classroomId` as well as `sectionId`, with a unique constraint on (`classroomId`, `userId`). The
database rejects a second Enrollment in the same Classroom whatever the request timing.

## Considered Options

- **`sectionId` only, check in code.** Rejected: racy without explicit locking.
- **`sectionId` only, serialize joins with a lock or `SERIALIZABLE` transaction.** Rejected: more moving parts than one
  extra column and a unique index.
- **Denormalized `classroomId` with a unique constraint.** Chosen, despite the rule against derived data, because the
  constraint needs it.

## Consequences

- `classroomId` must always equal the Section's Classroom. Moving a Student between Sections changes only `sectionId`;
  Sections never move between Classrooms, so the two cannot drift apart through normal use.
- Treat a unique-constraint violation on join as "already enrolled in this Classroom".

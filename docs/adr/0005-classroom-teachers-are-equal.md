# 0005. ClassroomTeachers are equal; one Classroom per course, Section teachers are labels

- Status: accepted
- Date: 2026-11-25

## Context

One course at KMUTNB is often taught by several Teachers, each taking some of its Sections. A Classroom could model this
with an owner who holds extra powers, with one Classroom per Teacher, or with per-Section permissions.

## Decision

All ClassroomTeachers of a Classroom are equal. Any of them can do anything in it, including adding and removing other
ClassroomTeachers; only the last one cannot be removed. `Classroom.createdById` records who created it (`SetNull`) and
grants nothing. Teachers are expected to share one Classroom per course, and a **Section teacher** list on each Section
records who teaches it for display and filtering only, never for access.

## Considered Options

- **An owner with extra powers (`ownerId`).** Rejected: needs an ownership hand-over flow, and a Classroom whose owner's
  User is deleted is left with nobody holding those powers.
- **Section teachers restrict access to their Sections.** Rejected: needs rules for who assigns Sections and breaks the
  "all equal" model for little gain among colleagues who already coordinate.
- **Equal ClassroomTeachers, labels for Sections.** Chosen.

## Consequences

- Do not add permission checks based on `createdById` or the Section teacher list without revisiting this ADR.
- Access checks are only "is this User a ClassroomTeacher of this Classroom".

# NextGen Grader

A university programming judge: students submit C++ to problems in their classrooms and get judged results back live.

## Identity and sign-in

**University account**:
A Google account on one of the university's email domains (students' or staff's). The only way to create a User.
_Avoid_: Google login, KMUTNB account

**User**:
A real person known to the system, created the first time they sign in with their University account.
_Avoid_: Account, member, profile

**Role**:
What a User may do system-wide: Student or Teacher. Not derived from the email domain.
_Avoid_: Permission, user type

**Student**:
A User with the Student role. Every new User starts as one.

**Teacher**:
A User with the Teacher role, able to create and run classrooms. Granted outside the app, never self-assigned.
_Avoid_: Instructor, admin, staff

**Credential setup**:
The one-time, mandatory step after a User's first sign-in where they choose a username and password.
_Avoid_: Registration, onboarding, sign-up

**Credentials**:
A User's username and password, usable as an alternative to signing in with their University account. The username is a sign-in handle only; it is never how a User is shown to others.
_Avoid_: Login, handle

**Display name**:
A User's real name, as given by their University account; how they are shown to Teachers and everyone else. Not editable in the app.
_Avoid_: Username, nickname

**Examinee**:
A separate exam-only account tied to one User for one Exam. Never usable outside that exam.
_Avoid_: Exam user, exam account

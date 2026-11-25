# NextGen Grader

A university programming judge: students submit code to problems in their classrooms and get judged results back live.

## Identity and sign-in

**University account**: A Google account on one of the university's email domains (students' or staff's). The only way
to create a User. _Avoid_: Google login, KMUTNB account

**User**: A real person known to the system, created the first time they sign in with their University account. _Avoid_:
Account, member, profile

**Role**: What a User may do system-wide: Student or Teacher. Not derived from the email domain. _Avoid_: Permission,
user type

**Student**: A User with the Student role. Every new User starts as one.

**Teacher**: A User with the Teacher role, able to create and run classrooms. Granted outside the app, never
self-assigned. _Avoid_: Instructor, admin, staff

**Credential setup**: The one-time, mandatory step after a User's first sign-in where they choose a username and
password. _Avoid_: Registration, onboarding, sign-up

**Credentials**: A User's username and password, usable as an alternative to signing in with their University account.
The username is a sign-in handle only; it is never how a User is shown to others. _Avoid_: Login, handle

**Credential rules**: The requirements a username and password must meet, the same in Credential setup, a username or
password change and Password reset. The server enforces them whatever the browser shows. _Avoid_: Password policy,
validation rules

**Password reset**: Choosing a new password without the current one. Allowed only shortly after signing in with the
University account, which is how a User proves who they are when they have forgotten their password. _Avoid_: Forgot
password, password recovery

**Display name**: A User's real name, as given by their University account; how they are shown to Teachers and everyone
else. Not editable in the app. _Avoid_: Username, nickname

**Examinee**: A separate exam-only account tied to one User for one Exam. Only this account can enter that Exam, and it
is never usable outside it. _Avoid_: Exam user, exam account

**Session**: A single active sign-in for one User or one Examinee; signing in again ends the previous one, and User and
Examinee sessions stay separate. It holds a copy of Role and Credential setup status from when it opened. _Avoid_:
Token, login state

## Classrooms and exams

**Classroom**: A course offering for one semester of one academic year, with a course code, a name and one language. The
language is C++17 unless the Teacher picks another when creating the Classroom, and it never changes after that. Users
submit in that language only. It may have several Exams, or none when the work is lab only. _Avoid_: Course, class,
subject

**ClassroomTeacher**: A Teacher who runs one Classroom. A Classroom always has at least one, and a Teacher who is not
one cannot see that Classroom. _Avoid_: Instructor, co-teacher, staff

**Closed classroom**: A Classroom a ClassroomTeacher has closed. Its ClassroomTeachers and Students can still read it,
but nobody can join it or submit to it until a ClassroomTeacher reopens it. A Classroom has no end date. _Avoid_:
Archived, ended, expired

**Exam**: One sitting of a Classroom, held separately from its other sittings. It has no late penalty: before it opens
the Examinee does not see its Problems, and after it closes no further Submission is allowed. _Avoid_: Test, quiz

**Server clock**: The time used for a Section assignment's open, late, and close, and for an Exam's open and close.
_Avoid_: User clock, local time

**All-mandatory**: A Classroom grading mode in which every lab Problem is Mandatory. _Avoid_: Pass-fail

**Mandatory-and-optional**: A Classroom grading mode whose course total is Mandatory points plus optional points. The
Teacher chooses both amounts. _Avoid_: Weighted total

**Mandatory-and-bonus**: A Classroom grading mode whose base is the Mandatory points. Optional points are an extra
amount the Teacher chooses, added on top of that base. _Avoid_: Extra credit

**Mandatory points**: The points a Classroom assigns to its Mandatory lab Problems. A User's share is the sum of their
best scores over the sum of those Problems' max scores. _Avoid_: Grade, total

**Optional target**: The point total that fills a Classroom's optional points. _Avoid_: Quota, goal

**Optional points**: The points a Classroom assigns to Optional lab Problems. The Teacher chooses the amount. A User's
share is always partial: the sum of best scores over the optional target. The share does not go above the amount the
Teacher chose. _Avoid_: Extra credit, maximum

**ExamStaff**: A Teacher assigned to run one Exam. A Teacher of another Classroom may be one. A Student cannot. _Avoid_:
Proctor, invigilator

## Problems

**Problem**: A programming task that belongs to one Classroom. It has a statement. _Avoid_: Question, exercise, task

**Draft**: A statement and test cases a Teacher has not saved. It is not a Problem until the Teacher saves it. _Avoid_:
Preview, template

**Test case**: An input and an output used to judge a Problem. It is a sample test case or a hidden test case. _Avoid_:
Example, check

**Sample test case**: A test case shown with the Problem's statement. The User sees its input and its output. _Avoid_:
Demo, public test

**Hidden test case**: A test case the User does not see. The User sees only pass or fail. _Avoid_: Secret test

**Weight**: A test case's share of the Problem's maximum score. A Try's score, before a late penalty, is the sum of the
weights of the test cases it passed, and this is the Problem's only scoring method. _Avoid_: Priority, rank

**Section**: A group of Students within one Classroom, with a five-character join code and a section number. The first
Section is 1 and each new one is one more than the highest existing number. Only a Section with no Enrollments can be
removed, and removing it does not change the other numbers. _Avoid_: Group, cohort, class, index

**Section teacher**: A ClassroomTeacher listed on one Section as the one who teaches it. A Section may have none or
several. The listing only tells people who teaches whom; every ClassroomTeacher can still manage every Section. _Avoid_:
Section owner, instructor

**Join code**: The five-character code of a Section, unique across all Classrooms. A Student enters it to enroll in that
one Section. A ClassroomTeacher can replace it, after which the old code no longer works, or close joining for that
Section. _Avoid_: Password, PIN

**Section assignment**: A lab Problem given to one Section, with no cap on Submissions. Before its open time Users in
that Section do not see it; after the close time they still see it and cannot submit unless the Teacher allows
Submissions, which take the late penalty. _Avoid_: Homework, slot, submission cap

**Enrollment**: A Student's place in one Section of a Classroom, at most one per Classroom. Only a ClassroomTeacher can
move it to another Section or remove it. That Student's lab Submissions use that Section's assignment. _Avoid_:
Registration, signup

**Lab problem**: A Problem on no Exam. It is Mandatory or Optional, and a Teacher can switch that. It may be assigned to
more than one Section of its Classroom. _Avoid_: Homework, coursework

**Exam problem**: A Problem that belongs to one Exam and has no Mandatory or Optional kind. No Section is assigned that
Problem. _Avoid_: Exam question

**Tag**: A topic on a Problem, such as loops. A Problem may have more than one. _Avoid_: Category, skill, label

**StudentSkill**: One User's Elo rating for one Tag in one Classroom, earned from Optional lab Problems only. _Avoid_:
Level, rank, score

**Skill level**: The calculated label for one User and one Tag. Below 3 rated Problems it is not enough data. Otherwise
it is weak below 1150, developing below 1300, and strong at 1300 or more. _Avoid_: Rank, grade

**Rating step**: A change to StudentSkill and the Problem rating from one of the first three Tries on an Optional lab
Problem. Each step is larger than the one before it, a later Solve moves StudentSkill up by less, and a fourth Try
changes neither. _Avoid_: Update, delta

**Problem rating**: The Elo of an Optional lab Problem. Rating steps move it, and a test-case change returns it to the
start value for its difficulty without changing StudentSkill. _Avoid_: Difficulty, level

**Difficulty**: Easy, medium, or hard, for an Optional lab Problem. The start Problem rating is 1000, 1200, or 1400.
_Avoid_: Level, rank

**Cooldown**: A pause on recommending an Optional lab Problem after three failed Tries. It ends after two lab Solves in
that Tag or after three days, and a Mandatory lab Problem can be one of the Solves while an exam Problem cannot.
_Avoid_: Lockout, ban

**Recommendation**: The three Optional lab Problems a Classroom offers a User, chosen as the ones closest to a 0.65
expected chance. A tie goes to the User's weaker Tag, and a Problem on cooldown is left out. _Avoid_: Suggestion, hint

## Chat and checks

**Local model**: The model that runs on our servers and serves lab chat, exam chat, and drafts. _Avoid_: External AI,
cloud model

**Lab chat**: The one chat a User has in a Classroom. It may repair a small bug, and for a logic bug it asks a question
instead of giving the solution, and when a filter removes a solution the unfiltered text is kept. _Avoid_: Tutor,
assistant

**Exam chat**: The one chat an Examinee has for an Exam. The Teacher sets a number of free messages, a message cap, and
a penalty. After the free messages, each message reduces the Examinee's score by that penalty, and an input that is too
long is rejected without using a message. _Avoid_: Exam tutor

**Plagiarism check**: A Dolos comparison of exam Submissions. Lab Submissions are not checked. _Avoid_: MOSS, similarity
scan

## Judging

**Best score**: A User's highest score on a Problem after any late penalty. A later Try with a higher score replaces it.
_Avoid_: Raw score, grade

**Late penalty**: The share a Section takes off a lab Submission's score after the late time. Best score uses the
reduced score. _Avoid_: Deduction, markdown

**Solved**: A User has solved a Problem when one of their Tries passed every test case. A late Try that did this still
Solves the Problem. _Avoid_: Passed, completed, accepted

**Try**: A Submission that compiled and was judged against the Problem's test cases. A compile error is not a Try.
_Avoid_: Attempt

**Submission**: Code a User or Examinee sends to be judged. A lab Submission belongs to the User's Enrollment. An exam
Submission belongs to an Examinee. _Avoid_: Upload, attempt

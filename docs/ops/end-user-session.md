# End a User's session after a Role change

A session keeps a copy of the User's Role. Changing `User.role` in Postgres does not change that copy. Delete the
session, then the User signs in again and the new Role is loaded.

`ngg.exam.sid` is reserved for Examinees. Do not delete Examinee keys when changing a User's Role.

## 1. Change the Role

```sql
SELECT id FROM "User" WHERE email = 'the-user@email.kmutnb.ac.th';
UPDATE "User" SET role = 'TEACHER' WHERE id = <id>;
```

`role` is `STUDENT` or `TEACHER`.

## 2. Delete the session in Redis

Use the Redis instance in `REDIS_URL`. `<id>` is the User id from the query above.

```
GET ngg:session:pointer:USER:<id>
DEL ngg:session:<cookie-id>
DEL ngg:session:pointer:USER:<id>
```

`<cookie-id>` is the value `GET` returned (a UUID). If `GET` returns `(nil)`, this User has no live session.

Example, for User 42 whose pointer is `3f2a1c0e-7b4d-4e1a-9c8f-6d5e4f3a2b10`:

```
GET ngg:session:pointer:USER:42
DEL ngg:session:3f2a1c0e-7b4d-4e1a-9c8f-6d5e4f3a2b10
DEL ngg:session:pointer:USER:42
```

The old `ngg.sid` cookie then gets 401 `NOT_SIGNED_IN`. The next sign-in (Google or password) starts a session with the
new Role.

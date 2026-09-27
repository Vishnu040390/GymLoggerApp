# GymLogger — GYM Tracking Application

A personal gym log built around four questions: *What should I do today? What did I do previously? Am I progressing? What should I change next?*

| Phase | Stack | Status |
|---|---|---|
| **1** | ASP.NET Core (.NET 10), REST API, SQL Server, web app for Admin and User | **In development**: solution, domain, API, persistence, web UI and tests are in place |
| 2 | React web client on the same API; MySQL or PostgreSQL | Planned |
| 3 | React Native: 3.1 Android, 3.2 iOS | Planned |

## Repository layout

```text
GYM.sln
├── src/
│   ├── GYM.Web/             HTTP only: controllers (/api/v1), middleware, auth, static web UI (wwwroot)
│   ├── GYM.Application/     use cases, DTOs, validation orchestration, repository interfaces
│   ├── GYM.Domain/          entities, enums, business rules, exceptions (no SQL/HTTP/UI dependencies)
│   ├── GYM.Infrastructure/  EF Core + SQL Server, repositories, password hashing, media storage, seeding
│   └── GYM.Tests/           Unit · Integration · API · Security
├── prototype/               UX prototype: the same web UI running on an in-browser mock API
├── docs/ui-ux/              Phase 1 UI/UX specification
├── deploy/azure/            one-command setup for the Azure test environment
└── .github/workflows/       ci.yml (build, tests on SQLite and SQL Server, UI smoke tests), deploy-test.yml
```

Dependencies point inwards: `Web → Application → Domain` and `Infrastructure → Application → Domain`. The application layer depends only on abstractions (`IWorkoutRepository`, `IClock`, `IFileStorage` and so on). Infrastructure supplies the implementations through dependency injection (spec §3–§6).

## Getting started

Prerequisite: the [.NET 10 SDK](https://dotnet.microsoft.com/download).

### Option A — quick start without SQL Server (SQLite)

```bash
dotnet run --project src/GYM.Web --launch-profile sqlite
# open http://localhost:5039
```

This creates `src/GYM.Web/App_Data/gymlogger-dev.db` with the exercise library, demo accounts and eight weeks of workout history.

### Option B — SQL Server (the Phase 1 database)

- **Windows:** the Development settings use LocalDB (`(localdb)\mssqllocaldb`). Run `dotnet run --project src/GYM.Web`.
- **macOS/Linux:** start SQL Server with Docker, then point the app at it:

```bash
export MSSQL_SA_PASSWORD='Your_strong_password1'
docker compose up -d
dotnet user-secrets --project src/GYM.Web set ConnectionStrings:Gym \
  "Server=localhost,1433;Database=GymLogger;User Id=sa;Password=$MSSQL_SA_PASSWORD;TrustServerCertificate=True"
dotnet run --project src/GYM.Web
```

In Development, migrations are applied on start-up. For other environments, apply them through the release pipeline (spec §43):

```bash
dotnet tool install --global dotnet-ef
dotnet ef database update -p src/GYM.Infrastructure -s src/GYM.Web
dotnet ef migrations script -p src/GYM.Infrastructure -s src/GYM.Web -o migrate.sql   # for review
```

### Option C — shared test site on Azure

A hosted test environment (App Service + Azure SQL, free tiers) deploys automatically from GitHub Actions. One-time setup takes about 10 minutes: see [docs/deployment/test-environment.md](docs/deployment/test-environment.md).

### Demo accounts (Development and Test)

| Account | Email | Password |
|---|---|---|
| Lifter with history | `demo@gymlogger.test` | `Demo@1234` |
| Administrator | `admin@gymlogger.test` | `Admin@1234` |
| Second user (isolation checks) | `other@gymlogger.test` | `Other@1234` |
| Inactive account (rejected) | `inactive@gymlogger.test` | `Inactive@1234` |

In Development the API description is at `/openapi/v1.json`. The health check at `/health` is available in every environment.

## Tests

```bash
dotnet test                                                     # 62 tests: unit, integration, API, security
node --test prototype/tests/domain.test.cjs                     # client-side rule tests
node prototype/tests/e2e-smoke.cjs                              # browser smoke test on the prototype (Playwright)
BASE_URL=http://localhost:5039 node prototype/tests/e2e-smoke.cjs   # same test against the running app
```

CI also runs the API and security tests, and the browser smoke test, against **SQL Server** in a container, with the real EF Core migrations applied. Locally you can do the same by setting `GYM_TEST_SQLSERVER` to a SQL Server connection string without a database name.

The API tests host the whole application (real middleware, authentication and EF Core) on an in-memory SQLite database. They cover:

- **Authentication:** the §28 matrix, including generic sign-in errors and throttling.
- **Workouts:** the §29 matrix and the §30 same-day sessions scenario.
- **Security:** user isolation (§26: user B gets 404 for every read or write on user A's workout), idempotent retries (§36), the CSRF header, safe error responses, and upload type/content/role checks (§23).

## Configuration

| Key | Default | Purpose |
|---|---|---|
| `ConnectionStrings:Gym` | *(required)* | Database connection. Use user secrets or environment variables, never committed settings (spec §45). |
| `Database:Provider` | `SqlServer` | `SqlServer` or `Sqlite` (local runs and tests). |
| `Database:ApplyMigrationsOnStartup` | `false` (`true` in Development) | Apply EF Core migrations on start-up. |
| `Seed:ReferenceData` | `true` | Create the starter exercise library when it is empty. |
| `Seed:AdminEmail` / `Seed:AdminPassword` | — | Bootstrap administrator. Provide as secrets. |
| `Seed:DemoData` / `Seed:DemoTimeZone` | `false` / `UTC` | Demo accounts and history (Development). |
| `Media:RootPath` / `Media:RequestPath` | `App_Data/media` / `/media` | Uploaded photos and videos (outside `wwwroot`). |
| `RateLimiting:AuthPermitPerMinute` | `20` | Sign-in and registration requests per minute per IP address. |

## API

All endpoints are under `/api/v1` and return `{ success, message, data, errors[{ field, message }] }` (spec §14):

| Area | Endpoints |
|---|---|
| Authentication | `POST auth/register`, `POST auth/login`, `POST auth/logout`, `GET auth/me`, `PUT users/me` |
| Exercises (admin writes) | `GET/POST exercises`, `GET/PUT exercises/{id}`, `PATCH exercises/{id}/status`, `GET/POST exercises/{id}/media`, `PUT/DELETE exercises/{id}/media/{mediaId}`, `POST exercises/{id}/media/reorder`, `GET reference`, `POST reference/{type}`, `PUT reference/{type}/{id}` |
| Workouts | `GET/POST workouts`, `GET workouts/active`, `GET workouts/{id}`, `POST workouts/{id}/complete`, `POST workouts/{id}/cancel`, `POST workouts/{id}/exercises`, `DELETE workout-exercises/{id}`, `POST workout-exercises/{id}/sets`, `PUT/DELETE workout-sets/{id}` |
| History and analytics | `GET exercises/{id}/history`, `GET exercises/{id}/comparison`, `GET exercises/{id}/analytics`, `GET analytics/summary` |

How it behaves:

- **Workout ownership:** every workout query is filtered by the signed-in user. Another user's record returns 404.
- **Duplicate protection:** POSTs accept an `Idempotency-Key` header, so retries never create duplicates.
- **CSRF protection:** state-changing calls must send `X-Requested-With`, and the authentication cookie is HttpOnly and SameSite=Strict.

## Where this differs from the spec's recommended structure

- **Folder names:** folders in `GYM.Application` are plural (`Users`, `Exercises`, `Workouts`, …) so namespaces don't clash with entity class names such as `User` and `Exercise`.
- **Schema additions** (see `docs/ui-ux/01-analysis.md`):
  - `ExerciseMedia.AltText`, `Title` and `DurationSeconds`.
  - `WorkoutSession.TimeZoneId`, used for Morning/Afternoon labels.
  - `CreatedBy`/`ModifiedBy` on admin-managed tables.
  - `AuditLog`, `LoginAttempt` and `IdempotencyRecord` tables.
- **Web client:** the Phase 1 web UI is a dependency-free JavaScript client in `wwwroot` that uses the REST API, instead of server-rendered pages. The same client runs in the prototype.

## Known gaps before production

- **Data Protection keys:** configure persistent, encrypted key storage so authentication cookies survive restarts and work across instances.
- **Media storage:** uploads are stored on local disk. Move them to blob storage behind `IFileStorage` for multi-instance hosting.
- **Missing account features:** password reset, email verification and account deletion (see `docs/ui-ux/01-analysis.md` §1.5).

## Documentation

- [`docs/ui-ux/`](docs/ui-ux/README.md): requirements analysis, information architecture, screen specs, design system, accessibility and QA traceability.
- [`prototype/`](prototype/README.md): UX prototype for design review. It needs no server.

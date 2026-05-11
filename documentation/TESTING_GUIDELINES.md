# Sortable — Testing Guidelines

> **IMPORTANT**: Follow these conventions for new tests. Align with [jest.config.js](../jest.config.js) and existing suites under `src/tests/` and `server/tests/`.

## Last Updated

2026-05-08

## Running tests

```bash
npm test
```

Jest runs two **projects**:

| Project  | Environment | Roots        | Typical use                    |
| -------- | ------------- | ------------ | ------------------------------ |
| `client` | `jsdom`       | `src/`       | React components, client logic |
| `server` | `node`        | `server/`    | Services with mocked I/O       |

## Client tests (`src/tests/`)

- Use **React Testing Library** (`render`, `screen`, `within`) and **`@testing-library/user-event`** for interactions.
- **Router**: wrap with `MemoryRouter` from `react-router-dom`. Prefer the same `future` flags as existing tests:

  ```js
  const routerFutureFlags = {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  };
  ```

- **Redux**: wrap with `Provider` and `configureStore` from `@reduxjs/toolkit`; include the reducers the component reads (see `src/tests/Nav.test.js`, `ListPage.test.js`).
- **Module mocks**: `jest.mock` API helpers (e.g. `../helpers/authHelpers`), `react-hot-toast`, or heavy native modules so tests stay fast and deterministic. Capacitor is already stubbed in [`src/setupTests.js`](../src/setupTests.js).
- **Queries**: prefer roles and accessible names (`getByRole`, `getByLabelText`) over test IDs unless a test ID is already the project standard for that component.

## Server tests (`server/tests/`)

- Do **not** require a live database unless an integration suite is explicitly added.
- **Mock the query layer** or other I/O modules (`jest.mock('../queries/...')` or `jest.mock('../queries')`) following [`server/tests/listService.test.js`](../server/tests/listService.test.js).
- **Clear mocks** in `beforeEach` (`jest.clearAllMocks()`).
- Test **happy path**, **validation failures**, and **error codes** (e.g. `USERNAME_TAKEN`) where services expose them.

## What to cover for new behavior

- Happy path.
- Failure and edge cases (empty input, conflicts, auth where relevant).
- Any new authorization rules tied to sessions or ownership.

## What not to do

- Do not add new test runners or assertion libraries without updating this document and [`documentation/ARCHITECTURE.md`](ARCHITECTURE.md).
- Avoid relying on implementation details (internal state, shallow snapshots) instead of user-visible behavior for UI tests.

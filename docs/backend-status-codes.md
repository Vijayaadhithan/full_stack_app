# Backend Status Codes Reference

This document summarizes the HTTP status codes you will see in API responses and logs emitted by the Express server (`server/index.ts`). Use it to interpret messages when reviewing monitoring output or ngrok requests.

## Successful responses

- **200 OK** – Standard success for GET, POST (non-creation), PUT or PATCH requests that return a payload.
- **201 Created** – Resource created successfully (e.g. registration/signup flows). Location headers may be included for the new resource.
- **204 No Content** – Operation succeeded but there is no response body (common for DELETE endpoints or background actions).

## Client errors (4xx)

- **400 Bad Request** – Request validation failed. Typically triggered by zod schema validation or malformed JSON bodies.
- **401 Unauthorized** – User is not authenticated. The session cookie may be missing/expired or credentials incorrect.
- **403 Forbidden** – Authentication succeeded but the action is not permitted (e.g. CSRF failures are logged here).
- **404 Not Found** – Resource or route does not exist. Double-check the URL path.
- **409 Conflict** – There is a state conflict (e.g. trying to create a duplicate resource).
- **422 Unprocessable Entity** – Semantic validation failed (field-level business rules).
- **429 Too Many Requests** – Rate limiting triggered (`express-rate-limit`). Wait and retry later.

All 4xx responses are considered "client errors" in `server/index.ts`; the stack trace is not logged in production, but the original message is returned to the client in development.

## Server errors (5xx)

- **500 Internal Server Error** – Unexpected failure. The server logs include an `errorId` to help correlate with external monitoring.
- **502 Bad Gateway** – Upstream dependency returned an invalid response (logged if proxied services fail, e.g. Stripe webhook).
- **503 Service Unavailable** – A required service (database, cache, external API) is offline or overloaded.

Server errors trigger the monitoring hook in `reportError`. In production the response body uses the generic message "An unexpected error occurred" and includes the `errorId`.

## Custom log metadata

When an error occurs the log record also captures:

- `status` – The HTTP status code resolved via `extractStatusCode`.
- `errorId` – UUID for tracing.
- `path` / `method` – Route that generated the error.
- `request` – Sanitized payload for production monitoring (sensitive fields are masked).

Use these fields alongside the status codes above to diagnose issues from backend log output or external aggregators.

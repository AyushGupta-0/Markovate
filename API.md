# API Documentation - Incident & Alerts System

## Base URL
```
http://localhost:3000
```

## Authentication
Currently no authentication is required. All endpoints are public.

## Headers

### Standard Headers
- `Content-Type: application/json` (for POST/PATCH requests)
- `X-Request-ID: <uuid>` (optional, for request tracing)

### Special Headers
- `Idempotency-Key: <unique-string>` (optional, for POST /v1/incidents)

## Response Headers
- `X-Request-ID: <uuid>` (present in all responses)
- `Retry-After: <seconds>` (present in 429 responses)

---

## Endpoints

### Health Checks

#### GET /health
Liveness check - always returns 200 if server is running.

**Response: 200 OK**
```json
{
  "status": "ok"
}
```

#### GET /ready
Readiness check - verifies database and Redis connectivity.

**Response: 200 OK**
```json
{
  "status": "ready",
  "database": "connected",
  "redis": "connected"
}
```

**Response: 503 Service Unavailable**
```json
{
  "status": "not ready",
  "database": "disconnected",
  "redis": "disconnected"
}
```

---

### Users

#### POST /v1/users
Create a new user.

**Rate Limited:** Yes (100 requests per minute)

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com"
}
```

**Validation:**
- `name`: Required, 1-255 characters
- `email`: Required, valid email format

**Response: 201 Created**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "John Doe",
  "email": "john@example.com",
  "createdAt": "2026-01-31T12:00:00.000Z"
}
```

**Errors:**
- `400` - Validation error
- `409` - Email already exists
- `429` - Rate limit exceeded

---

### Incidents

#### POST /v1/incidents
Create a new incident. Supports idempotency via `Idempotency-Key` header.

**Rate Limited:** Yes (100 requests per minute)

**Headers:**
- `Idempotency-Key: <unique-string>` (optional)

**Request Body:**
```json
{
  "title": "Database connection timeout",
  "description": "Production database is experiencing connection timeouts on the primary node",
  "severity": "P1",
  "createdBy": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Validation:**
- `title`: Required, 1-255 characters
- `description`: Required
- `severity`: Required, one of: `P1`, `P2`, `P3`
- `createdBy`: Required, valid UUID of existing user

**Response: 201 Created** (new incident)
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "title": "Database connection timeout",
  "description": "Production database is experiencing connection timeouts on the primary node",
  "severity": "P1",
  "status": "OPEN",
  "createdBy": "550e8400-e29b-41d4-a716-446655440000",
  "createdAt": "2026-01-31T12:00:00.000Z",
  "updatedAt": "2026-01-31T12:00:00.000Z"
}
```

**Response: 200 OK** (idempotent - incident already exists with same key and body)
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  ...
}
```

**Errors:**
- `400` - Validation error
- `404` - User not found
- `409` - Idempotency key conflict (same key, different body)
- `429` - Rate limit exceeded

**Idempotency Behavior:**
| Scenario | Response |
|----------|----------|
| New request, no key | 201 - Creates incident |
| New request, with key | 201 - Creates incident, stores key |
| Retry with same key + same body | 200 - Returns existing incident |
| Retry with same key + different body | 409 - Conflict error |

---

#### GET /v1/incidents
List incidents with filtering, sorting, and pagination.

**Rate Limited:** No

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| status | string | No | - | Filter by status: OPEN, ACK, RESOLVED |
| severity | string | No | - | Filter by severity: P1, P2, P3 |
| created_from | ISO 8601 | No | - | Filter incidents created after this date |
| created_to | ISO 8601 | No | - | Filter incidents created before this date |
| page | integer | No | 1 | Page number (min: 1) |
| limit | integer | No | 20 | Items per page (min: 1, max: 100) |

**Response: 200 OK**
```json
{
  "data": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "title": "Database connection timeout",
      "description": "Production database is experiencing connection timeouts",
      "severity": "P1",
      "status": "OPEN",
      "createdBy": "550e8400-e29b-41d4-a716-446655440000",
      "createdAt": "2026-01-31T12:00:00.000Z",
      "updatedAt": "2026-01-31T12:00:00.000Z",
      "user": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

**Sorting:**
- Results are always sorted by `createdAt` descending (newest first)
- This ensures stable ordering for pagination

**Errors:**
- `400` - Invalid query parameters

---

#### GET /v1/incidents/:id
Get a single incident with details and last 20 events.

**Rate Limited:** No  
**Cached:** Yes (5 minutes TTL)

**Path Parameters:**
- `id`: UUID of the incident

**Response: 200 OK**
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "title": "Database connection timeout",
  "description": "Production database is experiencing connection timeouts",
  "severity": "P1",
  "status": "ACK",
  "createdBy": "550e8400-e29b-41d4-a716-446655440000",
  "createdAt": "2026-01-31T12:00:00.000Z",
  "updatedAt": "2026-01-31T12:05:00.000Z",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "events": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "incidentId": "660e8400-e29b-41d4-a716-446655440001",
      "type": "STATUS_CHANGED",
      "payload": {
        "from": "OPEN",
        "to": "ACK"
      },
      "createdAt": "2026-01-31T12:05:00.000Z"
    },
    {
      "id": "770e8400-e29b-41d4-a716-446655440001",
      "incidentId": "660e8400-e29b-41d4-a716-446655440001",
      "type": "CREATED",
      "payload": {
        "title": "Database connection timeout",
        "description": "Production database is experiencing connection timeouts",
        "severity": "P1",
        "createdBy": "550e8400-e29b-41d4-a716-446655440000"
      },
      "createdAt": "2026-01-31T12:00:00.000Z"
    }
  ]
}
```

**Caching:**
- Cached in Redis with 5-minute TTL
- Cache key: `incident:{id}`
- Invalidated on status update or new comment

**Errors:**
- `400` - Invalid UUID format
- `404` - Incident not found

---

#### PATCH /v1/incidents/:id/status
Update incident status. Enforces valid state transitions.

**Rate Limited:** Yes (100 requests per minute)

**Path Parameters:**
- `id`: UUID of the incident

**Request Body:**
```json
{
  "status": "ACK"
}
```

**Validation:**
- `status`: Required, one of: `OPEN`, `ACK`, `RESOLVED`

**Valid State Transitions:**
```
OPEN → ACK
OPEN → RESOLVED
ACK → RESOLVED
```

**Invalid Transitions:**
```
ACK → OPEN (rejected)
RESOLVED → * (rejected - terminal state)
```

**Idempotent:** Setting the same status is allowed and returns current incident.

**Response: 200 OK**
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "title": "Database connection timeout",
  "description": "Production database is experiencing connection timeouts",
  "severity": "P1",
  "status": "ACK",
  "createdBy": "550e8400-e29b-41d4-a716-446655440000",
  "createdAt": "2026-01-31T12:00:00.000Z",
  "updatedAt": "2026-01-31T12:05:00.000Z"
}
```

**Side Effects:**
- Creates a `STATUS_CHANGED` event in the audit log
- Invalidates cache for this incident
- Updates `updatedAt` timestamp

**Errors:**
- `400` - Invalid status or invalid transition
- `404` - Incident not found
- `429` - Rate limit exceeded

**Error Example (Invalid Transition):**
```json
{
  "code": "INVALID_STATUS_TRANSITION",
  "message": "Cannot transition from ACK to OPEN",
  "request_id": "880e8400-e29b-41d4-a716-446655440003",
  "details": {
    "current_status": "ACK",
    "attempted_status": "OPEN",
    "allowed_transitions": ["RESOLVED"]
  }
}
```

---

#### POST /v1/incidents/:id/comments
Add a comment to an incident. Creates a `COMMENTED` event.

**Rate Limited:** Yes (100 requests per minute)

**Path Parameters:**
- `id`: UUID of the incident

**Request Body:**
```json
{
  "comment": "Investigation started. Checking database logs.",
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Validation:**
- `comment`: Required, minimum 1 character
- `userId`: Required, valid UUID

**Response: 201 Created**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440003",
  "incidentId": "660e8400-e29b-41d4-a716-446655440001",
  "type": "COMMENTED",
  "payload": {
    "comment": "Investigation started. Checking database logs.",
    "userId": "550e8400-e29b-41d4-a716-446655440000"
  },
  "createdAt": "2026-01-31T12:10:00.000Z"
}
```

**Side Effects:**
- Creates a new event in the audit log
- Invalidates cache for this incident

**Errors:**
- `400` - Validation error
- `404` - Incident not found
- `429` - Rate limit exceeded

---

## Event Types

Events are stored in the audit log and returned when fetching incident details.

### CREATED
Created when a new incident is created.

**Payload:**
```json
{
  "title": "string",
  "description": "string",
  "severity": "P1|P2|P3",
  "createdBy": "uuid"
}
```

### STATUS_CHANGED
Created when incident status is updated.

**Payload:**
```json
{
  "from": "OPEN|ACK|RESOLVED",
  "to": "OPEN|ACK|RESOLVED"
}
```

### COMMENTED
Created when a comment is added.

**Payload:**
```json
{
  "comment": "string",
  "userId": "uuid"
}
```

---

## Error Responses

All errors follow a consistent format:

```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable error message",
  "request_id": "uuid",
  "details": { /* optional additional context */ }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Request validation failed |
| INVALID_STATUS_TRANSITION | 400 | Invalid state transition attempted |
| USER_NOT_FOUND | 404 | User ID not found |
| INCIDENT_NOT_FOUND | 404 | Incident ID not found |
| USER_ALREADY_EXISTS | 409 | Email already registered |
| IDEMPOTENCY_KEY_CONFLICT | 409 | Same key used with different body |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| INTERNAL_SERVER_ERROR | 500 | Unexpected server error |

### Example Error Responses

**Validation Error:**
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "request_id": "880e8400-e29b-41d4-a716-446655440003",
  "details": {
    "body": [
      "\"severity\" must be one of [P1, P2, P3]"
    ]
  }
}
```

**Rate Limit:**
```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-Request-ID: 880e8400-e29b-41d4-a716-446655440003

{
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests, please try again later",
  "request_id": "880e8400-e29b-41d4-a716-446655440003"
}
```

---

## Rate Limiting

**Configuration:**
- Window: 60 seconds
- Max Requests: 100 per window
- Scope: Per IP address

**Applied to:**
- All POST endpoints
- All PATCH endpoints

**Headers in Response:**
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Time when limit resets (Unix timestamp)
- `Retry-After`: Seconds to wait (only in 429 response)

---

## Request Tracing

Every request is assigned a unique `request_id`:
- Auto-generated if not provided
- Can be provided via `X-Request-ID` header
- Returned in `X-Request-ID` response header
- Included in all error responses
- Logged with every request

Use request IDs to trace requests through logs for debugging.

---

## Examples

### cURL Examples

**Create User:**
```bash
curl -X POST http://localhost:3000/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Johnson",
    "email": "alice@example.com"
  }'
```

**Create Incident (with idempotency):**
```bash
curl -X POST http://localhost:3000/v1/incidents \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: my-unique-key-123" \
  -d '{
    "title": "API response time degradation",
    "description": "API endpoints responding slower than baseline",
    "severity": "P2",
    "createdBy": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

**List Open P1 Incidents:**
```bash
curl "http://localhost:3000/v1/incidents?status=OPEN&severity=P1"
```

**Update Status:**
```bash
curl -X PATCH http://localhost:3000/v1/incidents/660e8400-e29b-41d4-a716-446655440001/status \
  -H "Content-Type: application/json" \
  -d '{"status": "ACK"}'
```

**Add Comment:**
```bash
curl -X POST http://localhost:3000/v1/incidents/660e8400-e29b-41d4-a716-446655440001/comments \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "Root cause identified - disk space issue",
    "userId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

**Get Incident Details (cached):**
```bash
curl http://localhost:3000/v1/incidents/660e8400-e29b-41d4-a716-446655440001
```

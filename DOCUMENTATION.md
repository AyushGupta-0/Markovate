# Incident & Alerts System - Complete Documentation

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Setup Instructions](#setup-instructions)
- [API Documentation](#api-documentation)
- [Database Design](#database-design)
- [Production Features](#production-features)
- [Testing](#testing)
- [Deployment](#deployment)
- [Debugging Guide](#debugging-guide)

## Architecture Overview

### Technology Stack
- **Backend**: Node.js with Express, TypeScript
- **Database**: PostgreSQL 16 with Prisma ORM
- **Cache**: Redis 7 for response caching
- **Frontend**: Next.js 15 with React, TypeScript, Tailwind CSS
- **Deployment**: Docker & Docker Compose

### System Architecture
```
Frontend (Next.js) → Backend API (Express) → PostgreSQL
                              ↓
                           Redis Cache
```

## Setup Instructions

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development)
- Git

### Quick Start (Production)
```bash
# Clone the repository
git clone <repo-url>
cd incident-alerts

# Start all services
docker compose up --build
```

**Services:**
- Backend API: http://localhost:3000
- Frontend: http://localhost:3001
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### Local Development Setup

#### Backend
```bash
cd backend
npm install
cp .env.example .env

# Update DATABASE_URL in .env

# Run migrations
npm run prisma:migrate

# Seed database (optional)
npm run prisma:seed

# Start dev server
npm run dev
```

#### Frontend
```bash
cd frontend
npm install
cp .env.example .env

# Start dev server
npm run dev
```

## API Documentation

All endpoints are under `/v1` prefix.

### Health & Readiness

#### GET /health
Basic liveness check.

**Response:**
```json
{
  "status": "ok"
}
```

#### GET /ready
Checks database and Redis connectivity.

**Response:**
```json
{
  "status": "ready",
  "database": "connected",
  "redis": "connected"
}
```

### Users

#### POST /v1/users
Create a new user.

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "createdAt": "2026-01-31T12:00:00Z"
}
```

**Errors:**
- `409 Conflict` - Email already exists

### Incidents

#### POST /v1/incidents
Create a new incident. Supports idempotency.

**Headers:**
- `Idempotency-Key` (optional): Unique key for idempotent requests

**Request:**
```json
{
  "title": "Database connection timeout",
  "description": "Production DB experiencing timeouts",
  "severity": "P1",
  "createdBy": "user-uuid"
}
```

**Response:** `201 Created`
```json
{
  "id": "incident-uuid",
  "title": "Database connection timeout",
  "description": "Production DB experiencing timeouts",
  "severity": "P1",
  "status": "OPEN",
  "createdBy": "user-uuid",
  "createdAt": "2026-01-31T12:00:00Z",
  "updatedAt": "2026-01-31T12:00:00Z"
}
```

**Idempotency Behavior:**
- Same key + same body = Returns existing incident (200 OK)
- Same key + different body = Returns 409 Conflict

**Errors:**
- `400 Bad Request` - Validation error
- `404 Not Found` - User not found
- `409 Conflict` - Idempotency key conflict
- `429 Too Many Requests` - Rate limit exceeded

#### GET /v1/incidents
List incidents with filtering and pagination.

**Query Parameters:**
- `status` (optional): OPEN, ACK, or RESOLVED
- `severity` (optional): P1, P2, or P3
- `created_from` (optional): ISO date
- `created_to` (optional): ISO date
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 20, max: 100): Items per page

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Incident title",
      "description": "Description",
      "severity": "P1",
      "status": "OPEN",
      "createdBy": "user-uuid",
      "createdAt": "2026-01-31T12:00:00Z",
      "updatedAt": "2026-01-31T12:00:00Z",
      "user": {
        "id": "user-uuid",
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

#### GET /v1/incidents/:id
Get incident details with last 20 events. **This endpoint is cached.**

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "title": "Incident title",
  "description": "Description",
  "severity": "P1",
  "status": "ACK",
  "createdBy": "user-uuid",
  "createdAt": "2026-01-31T12:00:00Z",
  "updatedAt": "2026-01-31T12:00:00Z",
  "user": {
    "id": "user-uuid",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "events": [
    {
      "id": "event-uuid",
      "incidentId": "incident-uuid",
      "type": "CREATED",
      "payload": { ... },
      "createdAt": "2026-01-31T12:00:00Z"
    }
  ]
}
```

**Errors:**
- `404 Not Found` - Incident not found

#### PATCH /v1/incidents/:id/status
Update incident status. Enforces valid transitions.

**Request:**
```json
{
  "status": "ACK"
}
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "title": "Incident title",
  "status": "ACK",
  ...
}
```

**Valid Status Transitions:**
- OPEN → ACK or RESOLVED
- ACK → RESOLVED
- RESOLVED → (none)

**Idempotent:** Setting same status returns current incident without error.

**Errors:**
- `400 Bad Request` - Invalid status transition
- `404 Not Found` - Incident not found
- `429 Too Many Requests` - Rate limit exceeded

#### POST /v1/incidents/:id/comments
Add a comment to an incident.

**Request:**
```json
{
  "comment": "Investigation started",
  "userId": "user-uuid"
}
```

**Response:** `201 Created`
```json
{
  "id": "event-uuid",
  "incidentId": "incident-uuid",
  "type": "COMMENTED",
  "payload": {
    "comment": "Investigation started",
    "userId": "user-uuid"
  },
  "createdAt": "2026-01-31T12:00:00Z"
}
```

**Errors:**
- `404 Not Found` - Incident not found
- `429 Too Many Requests` - Rate limit exceeded

### Error Response Format

All errors follow this consistent format:

```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable error message",
  "request_id": "uuid",
  "details": { ... }
}
```

**Common Error Codes:**
- `VALIDATION_ERROR` (400)
- `USER_NOT_FOUND` (404)
- `INCIDENT_NOT_FOUND` (404)
- `USER_ALREADY_EXISTS` (409)
- `IDEMPOTENCY_KEY_CONFLICT` (409)
- `INVALID_STATUS_TRANSITION` (400)
- `RATE_LIMIT_EXCEEDED` (429)
- `INTERNAL_SERVER_ERROR` (500)

## Database Design

### Schema

#### Users Table
```sql
users (
  id UUID PRIMARY KEY,
  name VARCHAR,
  email VARCHAR UNIQUE,
  created_at TIMESTAMP
)
```

#### Incidents Table
```sql
incidents (
  id UUID PRIMARY KEY,
  title VARCHAR,
  description TEXT,
  severity ENUM('P1', 'P2', 'P3'),
  status ENUM('OPEN', 'ACK', 'RESOLVED'),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

**Indexes:**
- `status` - For filtering by status
- `severity` - For filtering by severity
- `created_at` - For date range queries and sorting
- `created_by` - For user's incidents

#### Incident Events Table (Audit Log)
```sql
incident_events (
  id UUID PRIMARY KEY,
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  type ENUM('CREATED', 'STATUS_CHANGED', 'COMMENTED'),
  payload JSONB,
  created_at TIMESTAMP
)
```

**Indexes:**
- `incident_id` - For fetching incident events
- `created_at` - For ordering

#### Idempotency Keys Table
```sql
idempotency_keys (
  id UUID PRIMARY KEY,
  key VARCHAR UNIQUE,
  request_hash VARCHAR,
  response_incident_id UUID,
  expires_at TIMESTAMP,
  created_at TIMESTAMP
)
```

**Indexes:**
- `expires_at` - For cleanup of expired keys

### Migrations

Migrations are managed using Prisma.

**Create new migration:**
```bash
npm run prisma:migrate
```

**Deploy migrations (production):**
```bash
npm run prisma:deploy
```

**Migration files:** `backend/prisma/migrations/`

### Transactions

The following operations use database transactions for atomicity:
1. **Create Incident**: Incident + CREATED event
2. **Update Status**: Incident update + STATUS_CHANGED event

## Production Features

### 1. Caching with Redis

#### Strategy
- **Endpoint**: `GET /v1/incidents/:id`
- **TTL**: 300 seconds (5 minutes)
- **Key Format**: `incident:{id}`

#### Why 5 minutes?
- Balances freshness vs performance
- Incidents don't change frequently once acknowledged/resolved
- Reduces database load for detail page views

#### Cache Invalidation
Cache is invalidated when:
1. Status is updated (`PATCH /v1/incidents/:id/status`)
2. Comment is added (`POST /v1/incidents/:id/comments`)

**Implementation:**
```typescript
// On status update or comment
await invalidateCache(`incident:${id}*`);
```

This ensures users always see fresh data after mutations while benefiting from caching for read-heavy workloads.

#### Cache Correctness
- Write operations invalidate before returning response
- Pattern matching ensures all related keys are cleared
- Cache misses fall back to database automatically
- Redis errors are logged but don't fail requests (graceful degradation)

### 2. Idempotency

#### Implementation
Idempotency is supported on `POST /v1/incidents` via the `Idempotency-Key` header.

**How it works:**
1. Client sends request with unique `Idempotency-Key` header
2. System computes SHA-256 hash of request body
3. Checks if key exists in database:
   - Not found → Process request, store key + hash + incident ID
   - Found with same hash → Return existing incident (200 OK)
   - Found with different hash → Return 409 Conflict

**Key Expiry:**
- Default: 24 hours (configurable via `IDEMPOTENCY_KEY_EXPIRY_HOURS`)
- Expired keys are deleted automatically on lookup

**Benefits:**
- Prevents duplicate incidents from retry logic
- Safe to retry failed requests
- Network issues don't cause duplicates

### 3. Rate Limiting

#### Configuration
- **Window**: 60 seconds (configurable via `RATE_LIMIT_WINDOW_MS`)
- **Max Requests**: 100 per window (configurable via `RATE_LIMIT_MAX_REQUESTS`)
- **Scope**: Per IP address

#### Applied To
All write endpoints:
- `POST /v1/users`
- `POST /v1/incidents`
- `PATCH /v1/incidents/:id/status`
- `POST /v1/incidents/:id/comments`

#### Response
When rate limit is exceeded:
```
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests, please try again later",
  "request_id": "uuid"
}
```

#### Why Per-IP?
- Simple and effective for public APIs
- No authentication system in current implementation
- Could be changed to per-user with auth

### 4. Request Validation

All requests are validated using Joi schemas:
- **Body validation**: POST/PATCH payloads
- **Query validation**: GET parameters
- **Param validation**: URL parameters (UUIDs)

**Error Response:**
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "request_id": "uuid",
  "details": {
    "body": ["\"severity\" must be one of [P1, P2, P3]"]
  }
}
```

### 5. Observability

#### Structured Logging
Every request is logged in JSON format:

```json
{
  "method": "POST",
  "path": "/v1/incidents",
  "status": 201,
  "duration_ms": 45,
  "request_id": "uuid",
  "timestamp": "2026-01-31T12:00:00Z"
}
```

#### Request ID
- Generated for every request (or use client-provided `X-Request-ID`)
- Propagated in response headers: `X-Request-ID`
- Included in all error responses
- Useful for tracing requests across services

#### Health Checks
- `/health` - Basic liveness (always returns 200)
- `/ready` - Checks DB + Redis connectivity

## Testing

### Running Tests

**All tests:**
```bash
cd backend
npm test
```

**Watch mode:**
```bash
npm run test:watch
```

**Integration tests only:**
```bash
npm run test:integration
```

### Test Coverage

#### Unit Tests
- **Status transitions** (`src/tests/unit/statusTransition.test.ts`)
  - Valid transitions (OPEN→ACK, OPEN→RESOLVED, ACK→RESOLVED)
  - Invalid transitions (ACK→OPEN, RESOLVED→any)
  - Idempotent (same status allowed)

- **Idempotency** (`src/tests/unit/idempotency.test.ts`)
  - Hash generation consistency
  - Key storage and retrieval
  - Conflict detection

- **Cache** (`src/tests/unit/cache.test.ts`)
  - Set and get operations
  - Pattern-based invalidation
  - TTL behavior

#### Integration Tests
- **Create incident** - Full flow with database
- **Update status** - Transaction handling
- **Fetch incident** - With events
- **List incidents** - Pagination
- **Idempotency** - End-to-end

### Test Database
Tests use real PostgreSQL (via Docker). Setup handled in `src/tests/setup.ts`.

## Deployment

### Docker Compose (Single Command)

```bash
docker compose up --build
```

This starts:
1. PostgreSQL container
2. Redis container
3. Backend API (runs migrations automatically)
4. Frontend

### Production Considerations

#### Database Migrations
- Migrations run automatically on container start
- For zero-downtime: run migrations separately before deployment

#### Environment Variables
Required in production:
```bash
# Backend
DATABASE_URL=postgresql://...
REDIS_HOST=redis
REDIS_PORT=6379
CACHE_TTL=300
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
IDEMPOTENCY_KEY_EXPIRY_HOURS=24

# Frontend
NEXT_PUBLIC_API_URL=https://api.example.com
```

#### Scaling
- Backend: Stateless, can scale horizontally
- Redis: Single instance sufficient for caching (can use Redis Cluster for HA)
- PostgreSQL: Use managed service (RDS, Cloud SQL) with read replicas

#### Monitoring
- Set up log aggregation (e.g., ELK, Datadog)
- Monitor key metrics:
  - API response times
  - Error rates (by endpoint)
  - Cache hit ratio
  - Database connection pool
  - Rate limit triggers

## Debugging in Production

### Checklist: Request Failed

1. **Get Request ID**
   - From error response or `X-Request-ID` header
   - Example: `a1b2c3d4-e5f6-...`

2. **Search Logs**
   ```bash
   grep "a1b2c3d4-e5f6" /var/log/app.log
   ```
   Look for:
   - Request details (method, path, body)
   - Response status and duration
   - Any errors or stack traces

3. **Check Status Code**
   - `400` → Validation error (check request payload)
   - `404` → Resource not found (verify ID exists)
   - `409` → Idempotency conflict or duplicate
   - `429` → Rate limited (client retry logic)
   - `500` → Server error (check stack trace)

4. **Database State**
   ```sql
   -- Check if incident exists
   SELECT * FROM incidents WHERE id = 'uuid';
   
   -- Check recent events
   SELECT * FROM incident_events 
   WHERE incident_id = 'uuid' 
   ORDER BY created_at DESC;
   ```

5. **Cache State**
   ```bash
   # Connect to Redis
   redis-cli
   
   # Check if key exists
   GET incident:uuid
   
   # Clear cache for testing
   DEL incident:uuid
   ```

### Checklist: Status Transition Failed

1. **Check Current Status**
   ```sql
   SELECT id, status FROM incidents WHERE id = 'uuid';
   ```

2. **Verify Transition Rules**
   - OPEN → ACK ✓
   - OPEN → RESOLVED ✓
   - ACK → RESOLVED ✓
   - ACK → OPEN ✗
   - RESOLVED → * ✗

3. **Check Error Details**
   Error response includes:
   ```json
   {
     "details": {
       "current_status": "ACK",
       "attempted_status": "OPEN",
       "allowed_transitions": ["RESOLVED"]
     }
   }
   ```

### Checklist: High Latency

1. **Check Recent Logs**
   Filter by `duration_ms > 1000`

2. **Database Performance**
   ```sql
   -- Slow queries
   SELECT query, mean_exec_time 
   FROM pg_stat_statements 
   ORDER BY mean_exec_time DESC 
   LIMIT 10;
   
   -- Check indexes
   SELECT * FROM pg_stat_user_indexes 
   WHERE schemaname = 'public';
   ```

3. **Cache Hit Rate**
   ```bash
   redis-cli INFO stats | grep keyspace
   ```

4. **Connection Pool**
   - Check if pool is exhausted
   - Increase `connection_limit` if needed

### Key Metrics to Monitor

1. **API Metrics**
   - Response time (p50, p95, p99)
   - Error rate (by endpoint)
   - Request volume

2. **Database**
   - Query duration
   - Connection pool usage
   - Lock waits

3. **Redis**
   - Cache hit/miss ratio
   - Memory usage
   - Eviction rate

4. **Application**
   - Rate limit triggers
   - Idempotency conflicts
   - Invalid status transitions

## Versioning Strategy

### Current: API v1

All endpoints are under `/v1` prefix.

### Adding New Fields (Non-Breaking)

**Example: Add priority field**

1. Add field to schema as optional:
```prisma
model Incident {
  ...
  priority String? // Optional
}
```

2. Create migration
3. Update validation schema (optional field)
4. Clients get new field in responses but don't need to send it

**Impact**: No breaking changes. Old clients continue working.

### Adding New Status (Breaking for some clients)

**Example: Add CANCELLED status**

**Option 1: Add to v1 (carefully)**
- Add to enum in database
- Add transition rules
- Update validation
- Document in changelog
- Risk: Clients expecting only 3 statuses may break

**Option 2: Create v2 (recommended)**
1. Duplicate endpoints under `/v2`
2. Add new status in v2 only
3. Keep v1 with 3 statuses
4. Document migration path
5. Deprecate v1 after grace period

### Rollback Strategy

#### Code Rollback
```bash
# Rollback to previous version
docker compose down
git checkout <previous-commit>
docker compose up --build
```

#### Database Rollback

**Safe approach:**
1. Never use destructive migrations in production
2. Always make migrations backward compatible:
   - Add columns as nullable
   - Don't drop columns immediately
   - Use feature flags for schema changes

**If rollback needed:**
```bash
# Stop services
docker compose down

# Rollback migration (if backward compatible)
cd backend
npx prisma migrate resolve --rolled-back <migration_name>

# Restart with old code
git checkout <previous-commit>
docker compose up --build
```

**Migration Best Practices:**
- Test migrations in staging
- Keep migrations small and focused
- Add new fields as optional
- Mark fields as deprecated before removal
- Run data migrations separately from schema changes

## API Response Examples

### Success Responses

**Create Incident:**
```bash
curl -X POST http://localhost:3000/v1/incidents \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: unique-key-123" \
  -d '{
    "title": "Database timeout",
    "description": "Timeouts on production DB",
    "severity": "P1",
    "createdBy": "user-uuid"
  }'
```

**Update Status:**
```bash
curl -X PATCH http://localhost:3000/v1/incidents/{id}/status \
  -H "Content-Type: application/json" \
  -d '{"status": "ACK"}'
```

**List with Filters:**
```bash
curl "http://localhost:3000/v1/incidents?status=OPEN&severity=P1&page=1&limit=20"
```

## License

ISC

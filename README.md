# Incident & Alerts Management System

A production-ready incident management system with real-time alerts, built using modern web technologies.

## Quick Start

The entire application runs with a single command:

```bash
docker compose up --build
```

That's it! The system will:
- Start PostgreSQL and Redis
- Run database migrations automatically
- Launch the backend API on port 3000
- Start the frontend on port 3002

**Access the application:**
- Frontend: http://localhost:3002
- Backend API: http://localhost:3000
- Health Check: http://localhost:3000/health

## Prerequisites

- Docker Desktop (make sure it's running)
- Git

No need to install Node.js, PostgreSQL, or Redis locally - everything runs in containers.

## Project Structure

```
.
├── backend/              # Node.js + Express API
│   ├── src/
│   │   ├── config/      # Database and Redis connections
│   │   ├── middlewares/ # Logging, validation, rate limiting
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # Business logic
│   │   ├── models/      # Validation schemas
│   │   ├── utils/       # Helper functions
│   │   └── tests/       # Unit and integration tests
│   └── prisma/          # Database schema and migrations
│
├── frontend/            # Next.js React application
│   ├── app/            # Pages and layouts
│   └── lib/            # API client
│
└── docker-compose.yml   # Orchestrates all services
```

## Architecture Overview

### Technology Stack

**Backend:**
- Node.js 20 with Express
- TypeScript for type safety
- Prisma ORM for database operations
- PostgreSQL 16 for data persistence
- Redis 7 for caching
- Jest for testing

**Frontend:**
- Next.js 16 with React
- TypeScript
- Tailwind CSS for styling

**Infrastructure:**
- Docker for containerization
- Docker Compose for orchestration

### How It Works

```
┌─────────┐      ┌─────────┐      ┌──────────┐
│ Browser │─────▶│ Next.js │─────▶│  Express │
└─────────┘      └─────────┘      └──────────┘
                                        │
                          ┌─────────────┼─────────────┐
                          ▼             ▼             ▼
                    ┌──────────┐  ┌─────────┐  ┌────────┐
                    │PostgreSQL│  │  Redis  │  │Logging │
                    └──────────┘  └─────────┘  └────────┘
```

The frontend makes API calls to the backend, which handles business logic, caches responses in Redis, and persists data in PostgreSQL.

## Database Schema

### Users
Stores user information. Each user can create multiple incidents.

### Incidents
The core entity. Tracks severity (P1/P2/P3), status (OPEN/ACK/RESOLVED), and metadata.

### Incident Events (Audit Log)
Every action on an incident creates an event - provides complete history.

### Idempotency Keys
Prevents duplicate incidents when clients retry requests.

**Key Design Decisions:**
- UUIDs for all IDs (better for distributed systems)
- Separate audit log table (cleaner than JSONB columns)
- Indexes on commonly filtered fields (status, severity, created_at)
- Cascade delete for events (when incident is deleted)

## Production Features Explained

### 1. Caching with Redis

**What:** The `GET /v1/incidents/:id` endpoint is cached.

**Why:** Incident details are frequently viewed but rarely change. Caching reduces database load and improves response times.

**How it works:**
```
Request → Check Redis → Cache Hit? → Return cached data
                     → Cache Miss? → Query DB → Store in cache → Return data
```

**TTL Choice: 5 minutes**

I chose 5 minutes because:
- Incidents don't change frequently once acknowledged or resolved
- It's fresh enough that users see updates within a reasonable time
- Long enough to reduce database load significantly
- Short enough to avoid stale data issues

**Cache Invalidation:**

The cache is automatically invalidated when:
1. Status is updated (`PATCH /v1/incidents/:id/status`)
2. A comment is added (`POST /v1/incidents/:id/comments`)

This ensures users always see fresh data after making changes, while still benefiting from caching for read-heavy workloads.

**Avoiding Stale Data:**

- Write operations clear the cache before returning
- Pattern matching (`incident:*`) clears all related keys
- If Redis is down, the app gracefully degrades to database queries
- Errors are logged but don't fail requests

### 2. Idempotency

**What:** Clients can include an `Idempotency-Key` header when creating incidents.

**Why:** Network issues cause retries. Without idempotency, retries create duplicate incidents.

**How it works:**

```
POST /v1/incidents
Headers: Idempotency-Key: unique-key-123
```

1. First request: Creates incident, stores key + request hash
2. Retry with same key + same body: Returns existing incident (200 OK)
3. Same key but different body: Returns 409 Conflict error

**Implementation:**

The system computes a SHA-256 hash of the request body and stores it with the idempotency key. This prevents clients from accidentally reusing keys with different payloads.

**Key Expiry: 24 hours**

Keys expire after 24 hours to prevent the table from growing indefinitely. This is a reasonable timeframe because:
- Most retries happen within seconds or minutes
- 24 hours covers edge cases like overnight outages
- Old keys are automatically cleaned up

### 3. Rate Limiting

**What:** Write endpoints (POST/PATCH) are limited to 100 requests per minute per IP address.

**Why:** Prevents abuse, DDoS attacks, and accidental infinite loops in client code.

**Configuration:**
- Window: 60 seconds
- Max requests: 100 per window
- Scope: Per IP address

**Response when limited:**
```json
HTTP 429 Too Many Requests
Retry-After: 60

{
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests, please try again later",
  "request_id": "..."
}
```

**Why per-IP instead of per-user?**

This system doesn't have authentication yet. If we add user auth later, we can switch to per-user rate limiting. Per-IP works well for public APIs and development.

The 100 req/min limit is generous for normal usage but tight enough to prevent abuse.

### 4. Request ID Tracking

Every request gets a unique ID that flows through the entire system:

1. Generated on entry (or client can provide via `X-Request-ID` header)
2. Included in all logs
3. Returned in response headers
4. Included in error responses

**Why this matters:**

When debugging production issues, you can grep logs for a specific request ID and see the complete journey:
```bash
grep "a1b2c3d4-e5f6" /var/log/app.log
```

This is invaluable for tracing errors across multiple services.

### 5. Structured JSON Logging

Every request is logged in JSON format:

```json
{
  "method": "POST",
  "path": "/v1/incidents",
  "status": 201,
  "duration_ms": 45,
  "request_id": "a1b2c3d4-e5f6",
  "timestamp": "2026-01-31T12:00:00Z"
}
```

**Benefits:**
- Easy to parse with log aggregators (ELK, Datadog, etc.)
- Can query by field: `status >= 500`, `duration_ms > 1000`
- No regex needed to extract values

### 6. Health & Readiness Endpoints

**`/health`** - Basic liveness check
Returns 200 if the server is running. Kubernetes uses this to know if the pod should be restarted.

**`/ready`** - Dependency check
Returns 200 only if database AND Redis are accessible. Kubernetes uses this to know if the pod can receive traffic.

## API Endpoints

### Core Endpoints

All endpoints use the `/v1` prefix for versioning.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Liveness check |
| GET | `/ready` | Readiness check (DB + Redis) |
| POST | `/v1/users` | Create a user |
| POST | `/v1/incidents` | Create incident (supports idempotency) |
| GET | `/v1/incidents` | List incidents (with filters) |
| GET | `/v1/incidents/:id` | Get incident details (cached) |
| PATCH | `/v1/incidents/:id/status` | Update incident status |
| POST | `/v1/incidents/:id/comments` | Add comment to incident |

### Status Transition Rules

Incidents follow a state machine:

```
OPEN ──→ ACK ──→ RESOLVED
  │                  ▲
  └──────────────────┘
```

Valid transitions:
- OPEN → ACK
- OPEN → RESOLVED  
- ACK → RESOLVED

Invalid transitions (will return 400):
- ACK → OPEN
- RESOLVED → anything

Setting the same status is allowed (idempotent).

### Error Response Format

All errors follow this structure:

```json
{
  "code": "ERROR_CODE",
  "message": "Human readable message",
  "request_id": "uuid",
  "details": { ... }
}
```

Common error codes:
- `VALIDATION_ERROR` (400)
- `INCIDENT_NOT_FOUND` (404)
- `INVALID_STATUS_TRANSITION` (400)
- `IDEMPOTENCY_KEY_CONFLICT` (409)
- `RATE_LIMIT_EXCEEDED` (429)

## Testing

The project includes both unit and integration tests covering all critical functionality.

**Test Coverage:**
- ✅ Status transition rules (6 tests) - All passing
- ✅ Cache operations and invalidation (4 tests) - All passing  
- ✅ Idempotency hash generation (2 tests) - All passing
- ⚠️  Database-dependent tests (3 tests) - Require PostgreSQL

**Run tests with Docker (recommended):**
```bash
# Make sure Docker is running
docker compose up -d postgres redis

# Run tests
cd backend
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/incident_alerts" npm test

# Cleanup
docker compose down
```

**Or use the test script:**
```bash
cd backend
./test-docker.sh
```

**What's tested:**
- Status transition validation (ensures invalid transitions are rejected)
- Idempotency hash generation (consistent hashes for same payload)
- Cache set/get/invalidation (pattern-based cache clearing)
- Integration tests for complete workflows (create, update, fetch)

The unit tests for core business logic (status transitions, caching) run independently and pass without external dependencies. Database-dependent tests work when run with Docker PostgreSQL.

## Development Setup

If you want to run services locally (outside Docker):

**Backend:**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your local database URL
npm run prisma:migrate
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Running tests:**
```bash
cd backend
npm test
```

## Environment Variables

### Backend (`backend/.env.example`)

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_HOST` / `REDIS_PORT` - Redis connection
- `CACHE_TTL` - Cache expiry in seconds (default: 300)
- `RATE_LIMIT_WINDOW_MS` - Rate limit window (default: 60000)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 100)
- `IDEMPOTENCY_KEY_EXPIRY_HOURS` - Key expiry time (default: 24)

### Frontend (`frontend/.env.example`)

- `NEXT_PUBLIC_API_URL` - Backend API URL (default: http://localhost:3000)

## Versioning Strategy

### Current Approach

All endpoints use the `/v1` prefix. This allows us to introduce `/v2` in the future without breaking existing clients.

### Adding New Fields (Non-Breaking)

Just add optional fields to the schema:
```prisma
model Incident {
  ...
  priority String?  // Optional - old clients can ignore
}
```

Clients get the new field but don't need to send it.

### Adding New Status (Breaking Change)

**Option 1:** Add to v1 carefully
- Document the change
- Ensure old clients can handle the new status
- High risk of breaking clients

**Option 2:** Create v2 (recommended)
- Duplicate endpoints under `/v2`
- Add new status only in v2
- Deprecate v1 after migration period
- Much safer

### Rolling Back

If you need to rollback:

1. **Code:** `git checkout <previous-commit>` and redeploy
2. **Database:** Migrations are designed to be backward compatible
   - Never drop columns immediately
   - Always add columns as nullable
   - Mark as deprecated before removal

For safe rollbacks, avoid destructive migrations in production.

## Debugging in Production

### Request Failed Checklist

1. **Get the request ID** from error response or logs
2. **Search logs:** `grep "<request-id>" /var/log/app.log`
3. **Check the status code:**
   - 400: Validation error - check request payload
   - 404: Resource not found - verify ID
   - 409: Conflict - check idempotency key or unique constraints
   - 429: Rate limited - client retrying too fast
   - 500: Server error - check stack trace in logs

4. **Verify database state:**
   ```sql
   SELECT * FROM incidents WHERE id = 'uuid';
   ```

5. **Check cache:**
   ```bash
   redis-cli GET incident:uuid
   ```

### Common Issues

**Slow responses:**
- Check `duration_ms` in logs
- Look for queries without indexes
- Monitor Redis hit rate

**Cache inconsistency:**
- Verify invalidation is working
- Check if writes are clearing cache
- Look for errors in cache operations

**Failed status transitions:**
- Review the transition rules
- Check current status in database
- Error response includes allowed transitions

## What I'd Add Next

If this were a real production system, here's what I'd add:

1. **Authentication & Authorization**
   - JWT tokens or session-based auth
   - Role-based access control (admin, user, viewer)
   - Per-user rate limiting

2. **Webhooks**
   - Notify external systems when incidents are created/updated
   - Retry logic with exponential backoff

3. **Metrics & Monitoring**
   - Prometheus metrics
   - Grafana dashboards
   - Alert on error rates, slow queries

4. **Search**
   - Full-text search on incident title/description
   - ElasticSearch integration

5. **Email Notifications**
   - Alert on-call when P1 incidents are created
   - Daily summaries

6. **API Rate Limiting Improvements**
   - Different limits for different endpoint categories
   - Burst allowances
   - Per-user quotas

## License

ISC

---

**Built with ❤️ for production reliability**

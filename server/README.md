# AD TECH Intern Management Platform - Backend

This repository contains the backend API for the AD TECH Intern Management Platform. It is built around Node.js, Express, TypeScript, MongoDB, and Mongoose, and it implements authentication, RBAC, intern management, task tracking, official work sessions, attendance, presence verification hooks, reports, performance management, and admin APIs.

## Tech stack

- Node.js
- Express.js
- TypeScript
- MongoDB + Mongoose
- JWT Authentication
- Helmet + CORS + Rate limiting
- Swagger/OpenAPI documentation
- Jest for backend tests

## Architecture

- `src/app.ts` - Express application setup
- `src/server.ts` - server bootstrap and database connection
- `src/config` - environment and MongoDB config
- `src/controllers` - API handlers
- `src/routes` - route definitions
- `src/services` - business logic
- `src/models` - Mongoose schemas
- `src/middleware` - auth, validation, error handling
- `src/validators` - request validation
- `src/utils` - helpers and response formatting

## Installation

```bash
cd server
npm install
cp .env.example .env
```

Update the values in your local `.env` file before running the app.

## Required environment variables

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/intern-manager
JWT_SECRET=change_me
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=change_me
JWT_REFRESH_EXPIRES_IN=30d
FRONTEND_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
FACE_VERIFICATION_URL=http://localhost:8000/api/verify
FACE_VERIFICATION_KEY=your_face_verification_api_key_here
ATTENDANCE_SYSTEM_ACTIVE=false
OFFICIAL_ATTENDANCE_START_DATE=2026-10-01
SESSION_INTERVAL_SECONDS=30
MAX_OFFICIAL_SECONDS=28800
VERIFICATION_INTERVAL_MINUTES=30
```

## Run locally

### Development server

```bash
npm run dev
```

### Production build

```bash
npm run build
npm start
```

### Seed data

```bash
npm run seed
```

## API overview

The backend exposes the following API areas:

- `/api/v1/auth` - login, registration, current user, logout
- `/api/v1/interns` - intern profile management
- `/api/v1/projects` - project CRUD
- `/api/v1/tasks` - task creation, assignment, progress, submission, review
- `/api/v1/sessions` - work sessions, breaks, heartbeats
- `/api/v1/attendance` - attendance summaries
- `/api/v1/verifications` - verification workflow hooks
- `/api/v1/reports` - daily activity reports
- `/api/v1/performance` - performance history
- `/api/v1/documents` - URL-based document metadata
- `/api/v1/admin` - admin controls and overview

Swagger docs are available at `/docs` when the server starts.

## Database and schema overview

Core models included in the project:

- User
- InternProfile
- Project
- Task
- TaskSubmission
- WorkSession
- BreakSession
- Attendance
- PresenceVerification
- DailyReport
- PerformanceRecord
- Document
- Notification
- AuditLog

## Testing

```bash
npm test
```

## Deployment notes

- Never commit `.env` or any secret values.
- Keep MongoDB credentials and service keys in environment variables.
- The face verification service is intentionally kept behind configuration and does not store raw biometric data in the backend.
- The work session engine uses server-side timestamps and caps official active work at 8 hours / 28,800 seconds.

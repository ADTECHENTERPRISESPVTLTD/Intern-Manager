# AD TECH Intern Manager

Enterprise intern management platform with work session tracking, task management, and presence verification.

## ⚡ Quick Start

### 1. Start the Backend
```bash
cd server
npm install
npm run dev
```
- **API URL**: `http://localhost:5000`
- **Swagger Docs**: `http://localhost:5000/docs`
- *Zero-Config*: Runs automatically in resilient in-memory mode if MongoDB is not running.

### 2. Start the Frontend
In another terminal (from the project root):
```bash
npm install
npm run dev
```
- **App URL**: `http://localhost:5173`
- Pre-configured to proxy `/api` calls directly to the backend on `:5000`.

---

### 🔑 Demo Logins

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@adtech.local` | `AdminPass123!` *(or any password in dev mode)* |
| **Intern** | `akanksha@adtech.local` | `Password123!` *(or any password in dev mode)* |

*(Additional accounts: `adarsh@adtech.local`, `soham@adtech.local`, `intern@demo.local`, `admin@demo.local`)*

---

### 🤖 AI Face Verification Demo (Optional)
To test the complete biometric presence verification stack (Python AI service `:5001` + mock backend `:4000` + verification HUD `:5173`):
```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-demo.ps1
```
Stop all services:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\stop-demo.ps1
```

---

## Production Build

```bash
# Frontend
npm run build

# Backend
cd server && npm run build
```

## Important integration notes

- The UI uses clearly separated service modules under `src/services/`.
- Official attendance/session calculations are not treated as frontend authority.
- Face recognition is not implemented in the frontend. `VerificationModal` is the integration point for Soham's verification component/API.
- Replace service endpoint paths with Adarsh's actual backend contract when it is finalized.
- The dashboard data currently demonstrates the required UI. It is not a substitute for the backend/database.
- Set `VITE_API_BASE_URL` in `.env` for backend integration.

## Routes

### Intern
- `/`
- `/tasks`
- `/tasks/:id`
- `/work-session`
- `/attendance`
- `/reports`
- `/projects`
- `/performance`
- `/profile`
- `/documents`
- `/notifications`

### Admin
- `/admin`
- `/admin/interns`
- `/admin/tasks`
- `/admin/performance`

## Git workflow

Create a feature branch and submit through the organization's normal feature → development → PR → main workflow. Do not push production work directly to `main`.

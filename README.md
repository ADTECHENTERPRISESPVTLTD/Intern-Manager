# AD TECH Intern Manager — Frontend

Frontend implementation based on the AD TECH Task-05 frontend requirements.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Production build

```bash
npm run build
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

# Deploy: Vercel + Render

This repository is prepared for:

- frontend on Vercel
- API on Render

The new `Quotes` module does not require any extra deployment-only service. It uses the same API base URL, auth flow, uploads, and database as the rest of the app.

## Vercel

Configure the Vercel project with:

- Root Directory: `apps/web`
- Install Command: `cd ../.. && npm install`
- Build Command: `npm run build`

Set these environment variables in Vercel:

- `NEXT_PUBLIC_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api`
- `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY=...` if `/contact` is used

Keep `NEXT_STATIC_EXPORT` unset for production on Vercel. The app uses dynamic project routes such as:

- `/projects/[projectId]`
- `/projects/[projectId]/quotes`

Static export is not the right mode for those URLs.

## Render

The repo now includes [render.yaml](../render.yaml) for the API service.

If you configure the service manually in the Render dashboard, use:

- Root Directory: `apps/api`
- Build Command: `npm install && npm run db:generate && npm run build`
- Start Command: `npm run start`
- Health Check Path: `/api/health`

Set these environment variables in Render:

- `DATABASE_URL=...`
- `JWT_SECRET=...`
- `CORS_ORIGIN=https://YOUR-PROJECT.vercel.app`
- `PUBLIC_APP_URL=https://YOUR-PROJECT.vercel.app`
- `UPLOADS_DIR=/var/data/uploads`

Recommended:

- attach a persistent disk mounted at `/var/data/uploads`

`npm run start` already launches the API and runs `prisma migrate deploy` in parallel, so new migrations such as the `ProjectQuote` tables are applied during startup.

## CORS

`CORS_ORIGIN` should contain the main Vercel production URL. The API also accepts `https://*.vercel.app`, so preview deployments and branch URLs can call the Render API without extra code changes.

## Release checklist

1. Push this branch to GitHub.
2. Let Render deploy the API from the updated repository.
3. Let Vercel rebuild the frontend with the correct `NEXT_PUBLIC_API_URL`.
4. Open `/projects/:projectId/quotes` in production and verify supplier selection, quote entry, comparison, and winner application.

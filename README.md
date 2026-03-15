# WARR Backend

Backend API for Lovable Workplace Access & Resource Requests

## Setup

1. Clone repo
2. Create `.env` from `.env.example`
3. Run `npm install`
4. Run `npm start`

## Endpoints

- `POST /api/auth/login`
- `GET /api/requests`
- `POST /api/requests`
- `GET /api/requests/:id`
- `PATCH /api/requests/:id/status`
- `POST /api/requests/:id/comments`

## Render Hosting

- Set `DATABASE_URL` and `JWT_SECRET` in Render dashboard
- Use Node Web Service, build/start as above

# cleverfox-backend

A separate backend server for CleverFox.

## Setup

1. Install deps

`npm install`

2. Create `.env`

Copy `.env.example` to `.env` and fill values.

3. Run

`npm run dev`

## Endpoints

- `GET /health`
- `GET /spotify/status` (stub)
- `GET /tasks`
- `GET /tasks/stats`
- `POST /tasks` `{ "title": "..." }`
- `PATCH /tasks/:id` `{ "title"?, "status"?, "progress"? }`
- `DELETE /tasks/:id`

## MongoDB

`/tasks` endpoints require `MONGODB_URI` to be set in `backend/.env`.

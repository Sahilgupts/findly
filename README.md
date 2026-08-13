# Findly — Lost & Found MVP

Server-rendered community lost-and-found application using Express, MongoDB/Mongoose, and EJS (no React).

## Features
- Account registration and login with hashed passwords
- Lost/found listings with photo upload, category, date and location
- Search and filters
- Dashboard for reports and submitted claims
- Secure ownership-claim flow
- Admin review: approve/decline claims and update item status
- Responsive EJS UI

## Run locally
1. Install and start MongoDB locally, or provide a MongoDB Atlas connection string.
2. Copy `.env.example` to `.env` and set `MONGODB_URI` and `SESSION_SECRET`.
3. Run `npm install` then `npm run dev`.
4. Visit `http://localhost:3000`.

To make an administrator, register an account, then update that user's `role` to `admin` in MongoDB.

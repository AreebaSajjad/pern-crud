# MyStore — PERN Stack Product & Order Management Platform

A full-stack store management system built with **PostgreSQL, Express, React, and Node (PERN)**. It supports product/order/meeting management with role-based access (admin vs regular user), Google login, email-based password reset, and an AI-powered chat assistant (RAG) that can answer questions and perform actions (create orders, manage products, meetings, and users) through natural language.

---
## AI Code Review Webhook
Testing GitHub pull request AI code review integration.
# AI Code Review Test
// Testing GitHub AI code review

// Testing AI code review webhook


## Features

- **Authentication**
  - Email/password signup & login (JWT-based)
  - Google Sign-In
  - Forgot password via a 6-digit email reset code (not a link)
- **Role-based access control** — `admin` vs `user`
- **Products**
  - CRUD with up to 5 images per product
  - Auto-fetched stock photo (via Pexels) when a product is created without an image
- **Orders**
  - Place, cancel, and (for admins) update order status
  - Per-product order history
- **Meetings**
  - Schedule, edit, delete meetings with participants, time-slot picker, and mode (online/in-person)
- **AI Assistant (RAG Chatbot)**
  - OpenAI-powered chat with function calling
  - Role-aware context: admins can query/manage all data, regular users only see their own
  - Can create/update/delete products, meetings, users, and orders directly from chat (admin)
  - Conversation history per user, with a mobile-friendly slide-in chat history drawer
  - Supports image attachments in chat
- **OKF Query** — structured knowledge-file query endpoint for external agents/tools
- **Responsive UI** — mobile-friendly sidebar, chat drawer, and card-style tables for Orders/Users on small screens

---

## Tech Stack

**Backend:** Node.js, Express 5, PostgreSQL (`pg`), JWT, Multer (file uploads), Nodemailer, Google Auth Library, OpenAI API

**Frontend:** React 19 (Vite), React Router 7, Redux Toolkit, Axios, `@react-oauth/google`

---

## Project Structure

```
Pern-Backend-crud/
├── config/
│   └── pgDb.js              # Postgres connection + table creation (auto-migrates on boot)
├── controllers/              # Route handlers (auth, product, order, meeting, rag/chat, okf)
├── middleware/                # authMiddleware (JWT), adminMiddleware, upload (Multer)
├── routes/                    # Express route definitions per resource
├── templates/
│   └── resetPasswordEmail.js  # HTML email template for password reset
├── utils/                     # Chatbot tool executors, embeddings, OKF generator, mailer, stock image fetch
├── okf/                       # Auto-generated structured knowledge files (products)
├── uploads/                    # Uploaded product/chat images (served at /uploads)
├── server.js                   # App entry point
└── frontend/
    └── src/
        ├── pages/               # One file per route/page
        ├── components/          # Layout, Sidebar, Toast, ConfirmDialog, Spinner, etc.
        └── services/             # Axios API client
```

---

## Prerequisites

- Node.js 18+ (uses native `fetch`)
- PostgreSQL database (local or hosted, e.g. Supabase/Neon/Render)
- An OpenAI API key (for the chatbot)
- A Google OAuth Client ID (for Google login)
- SMTP credentials (for password reset emails, e.g. Gmail App Password)
- (Optional) A free Pexels API key (for auto product images)

---

## Setup

### 1. Backend

```bash
cd Pern-Backend-crud
npm install
```

Create a `.env` file in `Pern-Backend-crud/` with:

```env
PORT=5000

# PostgreSQL
PG_HOST=localhost
PG_PORT=5432
PG_USER=your_pg_user
PG_PASSWORD=your_pg_password
PG_DATABASE=your_db_name

# Auth
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_oauth_client_id

# Email (password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
COMPANY_NAME=MyStore

# AI Assistant
OPENAI_API_KEY=your_openai_api_key

# Optional — auto product image fetch when none is attached
PEXELS_API_KEY=your_pexels_api_key
```

Run the backend:

```bash
npm run dev      # nodemon, auto-restarts on changes
# or
npm start
```

Tables are created automatically on first boot (see `config/pgDb.js`) — no manual migration needed.

### 2. Frontend

```bash
cd Pern-Backend-crud/frontend
npm install
npm run dev
```

By default the frontend expects the backend at `http://localhost:5000` (see `src/services/api.js`) and runs on `http://localhost:5173`.

---

## Key API Routes

| Resource | Base path | Notes |
|---|---|---|
| Auth | `/api/auth` | signup, login, google, forgot-password, reset-password, users (admin), profile |
| Products | `/api/products` | CRUD, image upload (`images` field, up to 5) |
| Orders | `/api/orders` | create, my orders, all orders (admin), status update (admin), cancel |
| Meetings | `/api/meetings` | CRUD (admin creates/edits/deletes, users view their own) |
| AI Assistant | `/api/rag` | chat, conversations list/detail/delete |
| OKF | `/api/okf` | query, rebuild (admin) |

All protected routes require a `Bearer` JWT in the `Authorization` header.

---

## Notes

- Uploaded images are stored locally under `uploads/`.
- The chatbot uses OpenAI function calling — the exact tools available depend on the logged-in user's role (admins get product/meeting/user management tools; all users get order tools).
- Password resets never accept a typed password directly — a 6-digit code is emailed and used on the reset-password page.

// trigger test

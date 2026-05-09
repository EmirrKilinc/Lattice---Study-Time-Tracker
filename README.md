<p align="center">
  <img src="https://img.shields.io/badge/Lattice-Study%20Time%20Tracker-6366f1?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI2ZmZmZmZiIgZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgMThoLTFWMTFoMXY5em0wLTE0aC0xVjVoMXYxeiIvPjwvc3ZnPg==&logoColor=white" alt="Lattice" />
  <img src="https://img.shields.io/badge/Status-Live%20%F0%9F%9F%A2-success?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License" />
</p>

<h1 align="center">🕐 Lattice</h1>

<p align="center">
  <strong>Study Time Tracker — Know where every hour goes.</strong>
  <br />
  <i>Log your sessions • Track progress • Stay consistent</i>
</p>

<p align="center">
  <a href="https://lattice.qzz.io">
    <img src="https://img.shields.io/badge/🌐_Live_Demo-lattice.qzz.io-6366f1?style=flat-square" />
  </a>
  &nbsp;
  <img src="https://img.shields.io/badge/Spring_Boot-3.2-6DB33F?style=flat-square&logo=spring-boot&logoColor=white" />
  <img src="https://img.shields.io/badge/Java-17+-ED8B00?style=flat-square&logo=openjdk&logoColor=white" />
  <img src="https://img.shields.io/badge/MySQL-8.0-4479A1?style=flat-square&logo=mysql&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/JWT-Auth-black?style=flat-square&logo=jsonwebtokens&logoColor=white" />
  <img src="https://img.shields.io/badge/Google-OAuth2-4285F4?style=flat-square&logo=google&logoColor=white" />
</p>

---

## 🎯 What is Lattice?

**Lattice** is a full-stack **study time tracking** web application. Log your study sessions, organize them by subject, and visualize your progress — all secured behind JWT authentication with Google OAuth2 sign-in support.

Whether you're grinding for exams, building a daily learning habit, or just curious where your hours disappear — Lattice gives you the clarity to stay accountable.

> 🔗 **Try it live:** [https://lattice.qzz.io](https://lattice.qzz.io)

---

## ✨ Key Features

### ⏱️ Session Tracking
- **Start & Stop** — Log study sessions with precise start and end times
- **Subject Labels** — Tag every session with a subject or course name
- **Duration Logging** — Total time automatically calculated per session
- **Edit & Delete** — Full control over your session history

### 📚 Subject Management
- **Create Subjects** — Organize sessions into meaningful categories
- **Color Coding** — Visually distinguish subjects at a glance
- **Subject Breakdown** — See total time per subject instantly
- **Delete & Clean Up** — Remove subjects you no longer need

### 📊 Statistics Dashboard
- **Daily Summary** — How many hours did you study today?
- **Weekly Overview** — Spot patterns and stay consistent
- **Total Lifetime Hours** — Watch your effort accumulate
- **Per-Subject Analytics** — Know which areas get the most attention

### 🔐 Authentication & Security
- **JWT Authentication** — Stateless, token-based secure sessions
- **Google OAuth2** — Sign in with one click via your Google account
- **Role-Based Access** — Clean separation of user permissions
- **Protected Endpoints** — Every private route is guarded server-side

---

## 🏗️ Tech Stack

| Layer | Technology | Purpose |
|:------|:-----------|:--------|
| **Backend** | Spring Boot 3.2, Java 17 | RESTful API & business logic |
| **ORM** | Spring Data JPA / Hibernate | Database abstraction layer |
| **Database** | MySQL 8.0 | Relational data persistence |
| **Security** | Spring Security + JWT (`jjwt 0.12.6`) | Token-based authentication |
| **OAuth2** | Google Sign-In | Social authentication |
| **Validation** | Jakarta Bean Validation | Server-side input validation |
| **Frontend** | Vanilla JS + HTML/CSS | Lightweight, fast UI |
| **Build** | Maven | Dependency & build management |
| **Infra** | Docker + Docker Compose | One-command deployment |

---

## 🚀 Quick Start

### 🐳 Docker (Recommended)

The fastest way to run Lattice locally:

```bash
# 1. Clone the repository
git clone https://github.com/EmirrKilinc/Lattice---Study-Time-Tracker.git
cd Lattice---Study-Time-Tracker

# 2. Create your environment file
cp .env.example .env

# 3. Fill in your secrets (see Environment Variables section)
nano .env

# 4. Launch everything 🚀
docker-compose up --build
```

| Service | URL |
|:--------|:----|
| 🌐 Web App | http://localhost:8080 |
| 🗄️ MySQL | localhost:3307 |

The app automatically waits for the database to be healthy before starting — no race conditions, no fuss.

---

### 🛠️ Manual Setup (Without Docker)

<details>
<summary><b>📦 Run with Maven</b></summary>

**Requirements:** Java 17+, Maven 3.8+, MySQL 8.0

```bash
# Export your environment variables
export DB_URL=jdbc:mysql://localhost:3306/study_tracker?useSSL=false
export DB_USERNAME=root
export DB_PASSWORD=yourpassword
export DDL_AUTO=update
export JWT_SECRET=your_very_long_secret_key_here
export GOOGLE_CLIENT_ID=your_google_client_id
export GOOGLE_CLIENT_SECRET=your_google_client_secret

# Build & run
mvn clean install
mvn spring-boot:run
```

</details>

---

### 🔑 Setting Up Google OAuth2

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client ID**
5. Set the redirect URI to:
   ```
   http://localhost:8080/login/oauth2/code/google
   ```
6. Copy your **Client ID** and **Client Secret** into `.env`

---

## 📂 Project Structure

```
Lattice---Study-Time-Tracker/
├── 🐳 docker-compose.yml            # Multi-container orchestration
├── 🐳 Dockerfile                    # Spring Boot container image
├── 📄 .env.example                  # Environment variable template
├── 📄 pom.xml                       # Maven dependencies
└── 📂 src/main/
    ├── java/com/studytracker/
    │   ├── controller/              # 🎮 REST Controllers
    │   ├── service/                 # 🧠 Business Logic
    │   ├── repository/              # 🗄️ JPA Repositories
    │   ├── model/                   # 📦 JPA Entities
    │   ├── dto/                     # 📨 Request / Response DTOs
    │   ├── security/                # 🔐 JWT filter, config, OAuth2
    │   └── exception/               # ⚠️ Global error handling
    └── resources/
        ├── application.properties   # App configuration
        └── static/                  # 🖥️ Frontend assets (HTML/CSS/JS)
```

---

## 🔌 API Overview

All protected endpoints require the `Authorization: Bearer <token>` header.

### 🔓 Authentication

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `POST` | `/api/auth/register` | Register with email & password |
| `POST` | `/api/auth/login` | Login, receive JWT |
| `GET` | `/oauth2/authorization/google` | Start Google OAuth2 flow |

### ⏱️ Sessions

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/api/sessions` | List all user sessions |
| `POST` | `/api/sessions` | Create a new session |
| `PUT` | `/api/sessions/{id}` | Update a session |
| `DELETE` | `/api/sessions/{id}` | Delete a session |

### 📚 Subjects

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/api/subjects` | List all subjects |
| `POST` | `/api/subjects` | Create a subject |
| `DELETE` | `/api/subjects/{id}` | Delete a subject |

### 📊 Statistics

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/api/stats/summary` | Daily, weekly & total hours |
| `GET` | `/api/stats/by-subject` | Time breakdown per subject |

---

## 🗃️ Database Schema

### Core Entities

**👤 Users**
`id` · `email` · `password` · `role` · `created_at`

**⏱️ Sessions**
`id` · `user_id` · `subject_id` · `started_at` · `ended_at` · `duration_minutes`

**📚 Subjects**
`id` · `user_id` · `name` · `color`

---

## 🔐 Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```env
# ── Database ──────────────────────────────────────
DB_URL=jdbc:mysql://db:3306/study_tracker?useSSL=false
DB_USERNAME=tracker_user
DB_PASSWORD=your_secure_password
DDL_AUTO=update

# ── Security ──────────────────────────────────────
JWT_SECRET=your_very_long_and_secret_signing_key_here

# ── Google OAuth2 ─────────────────────────────────
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

| Variable | Description | Example |
|:---------|:------------|:--------|
| `DB_URL` | JDBC connection string | `jdbc:mysql://db:3306/study_tracker` |
| `DB_USERNAME` | Database user | `tracker_user` |
| `DB_PASSWORD` | Database password | `s3cr3t` |
| `DDL_AUTO` | Hibernate DDL mode | `update` / `validate` |
| `JWT_SECRET` | HS256 signing key (≥ 32 chars) | `a_very_long_random_string` |
| `GOOGLE_CLIENT_ID` | Google OAuth2 client ID | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 client secret | `GOCSPX-...` |

> ⚠️ **Never commit `.env` to version control.** Always use `.env.example` as the public template.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. 🍴 Fork the repository
2. 🌿 Create a feature branch: `git checkout -b feature/amazing-feature`
3. 💾 Commit your changes: `git commit -m 'Add amazing feature'`
4. 📤 Push to the branch: `git push origin feature/amazing-feature`
5. 🔁 Open a Pull Request

---

## 📞 Contact

**Developer:** Muhammet Emir Kılınç  
**Email:** emirkilinc27@gmail.com  
**GitHub:** [@EmirrKilinc](https://github.com/EmirrKilinc)

---

<p align="center">
  <br />
  <i>🕐 Every hour logged is a step forward.</i>
  <br /><br />
  <strong>© 2026 Lattice — Study Time Tracker</strong>
</p>
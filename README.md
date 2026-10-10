<div align="center">

# 🎙️ Meri Awaaz (मेरी आवाज़)
### Next-Gen Community Journalism, Viral Video Streaming & Autonomous AI Moderation Platform

<p align="center">
  <img src="frontend/public/logo.png" alt="Meri Awaaz Logo" width="120" height="120" style="border-radius: 24px;" />
</p>

[![React](https://img.shields.io/badge/Frontend-React_18_%2B_Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript_5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Backend-Node.js_%2B_Express-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB_%2B_Mongoose-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Docker](https://img.shields.io/badge/Deployment-Docker_Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)
[![Security](https://img.shields.io/badge/Security-AI_Blue_Team_Engine-E11D48?style=for-the-badge&logo=shield&logoColor=white)](#-ai-blue-team-autonomous-security-engine)
[![License](https://img.shields.io/badge/License-Apache_2.0-F59E0B?style=for-the-badge)](LICENSE)

<p align="center">
  <b>A modern blend of Instagram Reels + YouTube video delivery + LinkedIn creator networking.</b><br>
  Built on a zero-cost decentralized Telegram bot storage cluster with real-time profile alerts, geo-fenced regional moderation, and autonomous AI threat defense.
</p>

[Key Features](#-key-features) • [Screenshots Gallery](#-interface-showcase) • [Architecture](#-architecture--data-pipeline) • [Quickstart Guide](#-quickstart--docker-deployment) • [Security & RBAC](#-role-based-access-control-rbac)

</div>

---

## 📸 Interface Showcase

### 🎥 Viral Video Feed & Mobile Social Experience

| News Feed & Reels Video Player | Creator Profile & Engagement | Interaction & Sharing |
| :---: | :---: | :---: |
| <img src="https://github.com/user-attachments/assets/fd17b52d-15d6-4906-b014-8df056c6833d" width="300" alt="News Feed & Video Player" /> | <img src="https://github.com/user-attachments/assets/3d6f4458-ea8c-40c5-8bf9-fe94abe412a1" width="300" alt="Creator Profile" /> | <img src="https://github.com/user-attachments/assets/2846bb1c-a3b4-4576-a337-2a31b095e825" width="300" alt="Interaction & Sharing" /> |
| *Chunk-streamed high definition video reels with instant playback* | *LinkedIn-style creator profiles with view tracking* | *Community likes, comments, and fast sharing* |

### 🏛️ Regional Moderation & Geo-Fenced Workflows

| Geo-Fenced Moderator Inbox | Content Verification Workflow | Reporter Evidence Review |
| :---: | :---: | :---: |
| <img src="https://github.com/user-attachments/assets/e7d05bd6-2845-4cde-9fba-3ce3548262bd" width="300" alt="Moderator Inbox" /> | <img src="https://github.com/user-attachments/assets/34c75e16-0eac-4dd1-8aa0-d022b8e404eb" width="300" alt="Verification Queue" /> | <img src="https://github.com/user-attachments/assets/ff7ad85b-dcae-4f60-9dbf-d4ff5818aa81" width="300" alt="Report Evidence" /> |
| *City/State-restricted moderation queues* | *Single-click verification, strikes, or escalation* | *Community report triage and evidence evaluation* |

### 👑 Super Admin Governance & AI Security Center

| Master System Governance | User Sanctions & Permissions | Autonomous AI Threat Monitor |
| :---: | :---: | :---: |
| <img src="https://github.com/user-attachments/assets/2008cd32-c210-458c-a6a1-9cf5a38f952d" width="300" alt="Super Admin Panel" /> | <img src="https://github.com/user-attachments/assets/d67be275-4f6e-4f32-a1fc-9efbeeeb9743" width="300" alt="User Management" /> | <img src="https://github.com/user-attachments/assets/27b753ae-63e6-46a6-bde7-6dc1b8de9c0b" width="300" alt="AI Threat Center" /> |
| *Platform-wide storage quotas and bot cluster health* | *Role promotions, reputation audits & bans* | *Real-time risk scoring, anomaly detection & IP bans* |

---

## 🚀 Key Features

### 1. 🎬 Instagram Reels + YouTube Video Delivery
- High-performance chunk-based video streaming engine powered by HTTP Range requests.
- Reduced initial load latency and zero-buffering playback across mobile and desktop clients.
- Like, dislike, bookmark, and share citizen journalism stories directly from the feed.

### 2. ⚡ Telegram Cloud Storage Cluster (Zero AWS S3 Costs)
- Eliminates multi-thousand dollar monthly cloud media storage bills.
- Videos, audio broadcasts, and user avatars are distributed across a pool of background Telegram Worker Bots.
- Automated National and State storage tier routing with failover balancing.

### 3. 🔔 Real-Time Profile & Engagement Alerts
- **LinkedIn-Style Profile View Tracking**: When another authenticated user explores your creator profile, you instantly receive a real-time notification (`"User X viewed your profile"`).
- Real-time updates for follows, video likes, moderation decisions, and system notices.

### 4. 🏛️ Granular Role-Based Access Control (RBAC)
- **👤 Guest Users**: Privacy-safe feed viewing without access to private user profiles or upload forms.
- **🧑 Registered Citizens / Creators**: Upload stories, build channels, follow reporters, and manage notification feeds.
- **🛡️ Regional Moderators**: Geofenced access restricted strictly to their assigned State and City jurisdictions. Review pending videos, reject fake news, or escalate to Super Admin.
- **👑 Super Admin**: Full platform sovereignty, user promotions/demotions, strike management, storage cluster reconfiguration, and global ban actions.

### 5. ⚖️ Moderator Accountability & Strike System
- Automated oversight tracks moderator activity patterns.
- If a moderator approves or rejects content maliciously or without valid reports:
  - The system automatically flags the incident.
  - Escalates the case to the Super Admin review queue.
  - Permanently records strikes on the moderator profile to ensure transparent community trust.

### 6. 🤖 AI Blue Team Autonomous Security Engine
- Real-time intelligent behavioral analysis monitoring API access patterns.
- Detects credential stuffing, scrapers, coordinated report spam, and privilege escalation probes.
- Autonomous remediation: temporarily restricts high-risk accounts, applies dynamic rate limits, and triggers IP blocks.

---

## 🏗️ Architecture & Data Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Application                     │
│        React 18 • TypeScript • Tailwind CSS • Vite          │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    API Gateway & Routing                    │
│   Rate Limiter • JWT Auth Guards • Security Audit Logger    │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐
│      Core Services           │ │    AI Blue Team Defense      │
│ • /api/auth    • /api/social │ │ • Behavioral anomaly monitor │
│ • /api/profile • /api/notify │ │ • Automated threat scoring   │
│ • /api/users   • /api/admin  │ │ • Dynamic ban & rate limiter │
└──────────────┬───────────────┘ └──────────────┬───────────────┘
               │                                │
       ┌───────┴───────────────┬────────────────┘
       ▼                       ▼
┌──────────────┐       ┌──────────────────────────────┐
│   MongoDB    │       │ Telegram Cloud Storage Pool  │
│  (Mongoose)  │       │ • Multi-Bot Worker Cluster   │
│ Users • News │       │ • National & State Tiers     │
│ Moderation   │       │ • Video Chunk Streaming Svc  │
└──────────────┘       └──────────────────────────────┘
```

---

## 🛠️ Quickstart & Docker Deployment

Deploy the entire stack with Docker Compose in under 2 minutes:

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/)
- [Node.js 18+](https://nodejs.org/) (for local bare-metal development)

---

### Method A: One-Command Docker Deployment (Recommended)

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/sentinal404/Meri-awaaz-News-Portal.git
   cd Meri-awaaz-News-Portal
   ```

2. **Configure Environment**:
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env to customize your JWT SECRET and Super Admin password
   ```

3. **Start All Services**:
   ```bash
   docker compose up --build -d
   ```

4. **Access the Portal**:
   - **Frontend App**: `http://localhost:5173`
   - **Backend API**: `http://localhost:3004`
   - **MongoDB**: `localhost:27017`

---

### Method B: Manual Bare-Metal Development Setup

#### 1. Start MongoDB
Ensure MongoDB is running locally on port `27017`:
```bash
mongod --dbpath ./data/db
```

#### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
npm run dev
# Backend starts on http://localhost:3004
```

#### 3. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
# Frontend starts on http://localhost:5173
```

---

## 🔒 Security & Safe Harbor

Meri Awaaz implements comprehensive zero-trust defenses:

- **JWT Authentication**: Short-lived access tokens with secure refresh token rotation.
- **Strict Input Validation**: Protection against NoSQL query injections, prototype pollution, and XSS.
- **Rate Limiting**: Tiered endpoint rate limiters powered by Redis / memory caches.
- **Private Vulnerability Reporting**: Security researchers can submit confidential disclosures directly via [GitHub Security Advisories](https://github.com/sentinal404/Meri-awaaz-News-Portal/security/advisories/new).
- Full details in our [SECURITY.md](SECURITY.md).

---

## 📜 License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <b>Meri Awaaz (मेरी आवाज़)</b> — Empowering Communities Through Truth & Technology<br>
  <i>Crafted with ❤️ by <a href="https://github.com/sentinal404">Rishi Shakya</a></i>
</div>

<div align="center">

# 🎬 Meri Awaaz (मेरी आवाज़)
### Decentralized Video & Movie Streaming, Viral Shorts & Community Media Platform
**Powered by Unlimited Telegram Cloud Storage, Zero AWS S3 Costs & Autonomous AI Security**

<p align="center">
  <img src="frontend/public/logo.png" alt="Meri Awaaz Logo" width="128" height="128" style="border-radius: 28px;" />
</p>

[![React](https://img.shields.io/badge/Frontend-React_18_%2B_Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript_5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Backend-Node.js_%2B_Express-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB_%2B_Mongoose-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Docker](https://img.shields.io/badge/Deployment-Docker_Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)
[![Security](https://img.shields.io/badge/Security-AI_Blue_Team_Engine-E11D48?style=for-the-badge&logo=shield&logoColor=white)](#-autonomous-ai-blue-team-defense)
[![Vibe Coding](https://img.shields.io/badge/Crafted_With-Vibe_Coding-FF4081?style=for-the-badge&logo=sparkles&logoColor=white)](#-crafted-with-vibe-coding)
[![LinkedIn](https://img.shields.io/badge/Connect-LinkedIn_rishishakya-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/rishishakya)
[![License](https://img.shields.io/badge/License-Apache_2.0-F59E0B?style=for-the-badge)](LICENSE)

<p align="center">
  <b>A complete, self-hostable alternative to Netflix + YouTube + Instagram Reels.</b><br>
  Stream full-length 4K movies, anime series, viral shorts, and citizen journalism with zero cloud storage bills using a decentralized Telegram bot cluster, instant HTTP Range chunk streaming, real-time engagement alerts, and multi-tier moderation.
</p>

[Screenshots](#-visual-interface-tour) • [Streaming Architecture](#-how-it-works-zero-cost-movie--video-streaming) • [Key Features](#-core-capabilities) • [Quickstart Guide](#-quickstart--docker-deployment) • [Security & RBAC](#-role-based-access-control-rbac) • [Connect on LinkedIn](https://www.linkedin.com/in/rishishakya)

</div>

---

## 📸 Visual Interface Tour

### 🎥 1. Video, Movie & Media Streaming Suite

| Home Feed & Cinema Browse Grid | Movie & Video Watch Page (`/watch`) | Smart Video & Shorts Uploader (`/upload`) |
| :---: | :---: | :---: |
| <img src="https://github.com/user-attachments/assets/e7d05bd6-2845-4cde-9fba-3ce3548262bd" width="300" alt="Home Feed & Video Discovery" /> | <img src="https://github.com/user-attachments/assets/34c75e16-0eac-4dd1-8aa0-d022b8e404eb" width="300" alt="Cinema Watch Player" /> | <img src="https://github.com/user-attachments/assets/d67be275-4f6e-4f32-a1fc-9efbeeeb9743" width="300" alt="Smart Media Uploader" /> |
| **Video & Movie Discovery Feed**: YouTube/Netflix-style browse grid featuring custom thumbnails, duration badges (`23:40`, `24:29`, `3:42`), author metadata, views, and regional location filters. | **Cinema Watch Player**: Full-width theater player (streaming 1080p anime/movies), channel follow, Like/Dislike, Share, Report, expandable metadata, and "Up Next" recommendation sidebar. | **Smart Uploader**: Automatic length detection (≤1 min automatically converts into vertical **Shorts**, >1 min publishes as standard **Movie/Video stream**), drag & drop up to 500MB with geo-tagging. |

---

### 🌟 2. Creator Economy, Social Engagement & Real-Time Alerts

| Creator Channel Profile (`/profile`) | Moderator Reputation & Strikes Meter | Real-Time Notification Center (`/notifications`) |
| :---: | :---: | :---: |
| <img src="https://github.com/user-attachments/assets/ff7ad85b-dcae-4f60-9dbf-d4ff5818aa81" width="300" alt="Creator Profile" /> | <img src="https://github.com/user-attachments/assets/27b753ae-63e6-46a6-bde7-6dc1b8de9c0b" width="300" alt="Moderator Accountability" /> | <img src="https://github.com/user-attachments/assets/2008cd32-c210-458c-a6a1-9cf5a38f952d" width="300" alt="Real-Time Notifications" /> |
| **Creator Channel Hub**: Follower counter, Trust Score, strikes status, published verified video gallery with `VERIFIED` badges, bio, and creator monetization ("Buy me a coffee"). | **Moderator Accountability Meter**: Transparent public metrics showcasing Moderator Trust Score (35) and active strikes (1/3) to eliminate biased censorship. | **Real-Time Notification Hub**: Instant alerts for video approvals, follows, and LinkedIn-style profile view notifications (*"User X viewed your profile"*). |

---

### 🛡️ 3. Admin Governance, Analytics & System Control

| Admin Analytics Dashboard (`/admin`) | Administrative Audit Logs | Global Platform Limits & Quotas |
| :---: | :---: | :---: |
| <img src="https://github.com/user-attachments/assets/fd17b52d-15d6-4906-b014-8df056c6833d" width="300" alt="Admin Analytics Dashboard" /> | <img src="https://github.com/user-attachments/assets/3d6f4458-ea8c-40c5-8bf9-fe94abe412a1" width="300" alt="Administrative Audit Logs" /> | <img src="https://github.com/user-attachments/assets/2846bb1c-a3b4-4576-a337-2a31b095e825" width="300" alt="Global Platform Limits" /> |
| **Admin Metrics Overview**: Real-time counters for Total Users, Verified Videos, Pending Posts, Video Views, 7-day upload trend charts, and geographic distribution by state. | **Immutable Audit Logs**: Chronological log tracking all moderator actions, escalations, and overturns (`OVERTURN MOD_REJECTION`, `ESCALATE POST_SUSPICIOUS_REASON`). | **Platform Limits & Workers**: Master settings to configure daily video upload quotas per user, rate limits, and Telegram storage worker bot pools. |

---

## ⚡ How It Works: Zero-Cost Movie & Video Streaming

Traditional video portals face massive cloud bills: AWS S3 storage fees, Cloudflare bandwidth charges, and expensive CDN egress. **Meri Awaaz solves this completely**:

```
 ┌─────────────────────────────────────────────────────────────┐
 │                Client Browser (Watch Page)                  │
 │      HTML5 Video Player • HTTP Range Requests (206)         │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                    Node.js Streaming Engine                 │
 │   • Slices video requests into 512KB - 2MB byte-range chunks│
 │   • Zero disk caching required on application server        │
 └──────────────────────────────┬──────────────────────────────┘
                                │
               ┌────────────────┴────────────────┐
               ▼                                 ▼
 ┌───────────────────────────────┐ ┌───────────────────────────┐
 │ National Telegram Worker Pool │ │ State Storage Worker Pool │
 │ • WorkerBot1 (Auto-balancing) │ │ • WorkerBot3 (Failover)   │
 │ • WorkerBot2 (Parallel fetch) │ │ • WorkerBot4 (CDN Relay)  │
 └───────────────────────────────┘ └───────────────────────────┘
```

1. **Upload Pipeline**: When a movie, anime episode, or news reel is uploaded, the backend streams the file directly into a private Telegram Channel using a round-robin pool of helper Telegram Bots.
2. **Chunk-Streaming Delivery**: When a user clicks play, the client issues HTTP `Range: bytes=start-end` requests. The backend fetches *only the requested chunk* from Telegram's data centers, delivering seamless seek and zero-buffering playback without ever downloading the full movie file onto server disk.

---

## 🚀 Core Capabilities

### 1. 🍿 Multi-Genre Movie & Cinema Streaming
- Turn Meri Awaaz into an on-demand OTT movie and anime streaming hub.
- Full support for HD/1080p long-form videos with embedded metadata, custom title cards, and description drawers.
- Smart "Up Next" sidebar queue to keep viewers engaged across series episodes.

### 2. ⚡ Auto-Detecting Viral Shorts & Reels
- Automatic duration classifier: videos of **1 minute or less** are categorized into vertical **Quick Shorts**.
- Dedicated Shorts navigation tab optimized for fast-scrolling reels and mobile devices.

### 3. 👥 Social Networking & Profile Tracking
- **Profile Visitor Alerts**: Integrated LinkedIn-style notification system: receive instant notifications whenever another member visits your creator profile.
- Creator tipping: native support for external creator monetization buttons ("Buy me a coffee").
- Social interactions: Like, dislike counters, follower tracking, and comment threads.

### 4. 🗺️ Citizen Journalism & Geo-Tagged Heatmaps
- Explore videos and local news stories by State, District, and City.
- Interactive **Live Heatmap** displaying viral video density across geographic territories.
- Community reporting: users can flag fake news, harassment, or abusive uploads with direct evidence review.

### 5. 🏛️ Geo-Fenced Moderator Governance & Strike Accountability
- **Geofenced Moderator Scopes**: Regional moderators can only approve or reject content belonging to their assigned State/City.
- **Automated Anti-Abuse Strikes**: Questionable approvals or malicious rejections are automatically escalated to the Super Admin; moderators receive permanent strikes (e.g. `1/3 Strikes`) displayed on their profile.

### 6. 🤖 Autonomous AI Blue Team Defense
- Real-time intelligent behavioral guard monitoring API anomalies and abuse vectors.
- Automated rate limiting, temporary account suspension, and dynamic IP blacklisting against credential stuffing and scraper bots.

---

## 🛠️ Quickstart & Docker Deployment

Deploy the full stack (Frontend + Backend + MongoDB) in under 2 minutes:

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/)
- [Node.js 18+](https://nodejs.org/) (if running bare-metal)

---

### Option 1: Docker Compose (Recommended)

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/sentinal404/MeriAwaaz-Streaming-Platform.git
   cd MeriAwaaz-Streaming-Platform
   ```

2. **Configure Environment Variables**:
   ```bash
   cp backend/.env.example backend/.env
   # Customize JWT Secret and Super Admin credentials in backend/.env
   ```

3. **Launch Stack**:
   ```bash
   docker compose up --build -d
   ```

4. **Open in Browser**:
   - **Frontend Video Portal**: `http://localhost:5173`
   - **Backend API**: `http://localhost:3004`
   - **MongoDB**: `localhost:27017`

---

### Option 2: Bare-Metal Local Development

#### 1. Backend Service
```bash
cd backend
npm install
cp .env.example .env
npm run dev
# Starts on http://localhost:3004
```

#### 2. Frontend Web App
```bash
cd ../frontend
npm install
npm run dev
# Starts on http://localhost:5173
```

---

## 🔐 Role-Based Access Control (RBAC)

| Role | Browse & Watch | Upload Shorts/Movies | Regional Moderation | AI Threat Center | Master Admin |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Guest User** | ✅ (Public Feed) | ❌ | ❌ | ❌ | ❌ |
| **Registered User** | ✅ | ✅ (Subject to daily quota) | ❌ | ❌ | ❌ |
| **Regional Moderator** | ✅ | ✅ | ✅ (Assigned State/City only) | ❌ | ❌ |
| **Super Admin** | ✅ | ✅ | ✅ (Global Overturn) | ✅ | ✅ |

---

## 💖 Crafted with Vibe Coding

Meri Awaaz was developed end-to-end using pure **Vibe Coding** — an iterative, high-velocity paradigm combining creative product vision with autonomous agentic intelligence.

- **100% Fully Working & Tested**: Full-stack pipeline verified end-to-end with active MongoDB schemas, Express HTTP 206 chunk-streaming endpoints, and React/Tailwind interfaces.
- **Production-Ready Architecture**: Multi-bot Telegram cluster balancing, range request video slicing, and autonomous AI threat security are ready for deployment out of the box.

---

## 🌟 Support & Connect

If you like this project or find it useful, please consider supporting it:

- ⭐ **Star this repository!** It helps more developers discover free, decentralized media streaming architectures.
- 🤝 **Connect with me on LinkedIn**: [**Rishi Shakya**](https://www.linkedin.com/in/rishishakya) (Let's talk tech, cloud architectures & vibe coding!)
- 🐛 **Security Disclosures**: Review [SECURITY.md](SECURITY.md) to report vulnerabilities privately.

---

## 🔒 Security & Safe Harbor

Meri Awaaz follows strict responsible disclosure principles:
- **Private Vulnerability Reporting**: Enabled on this repository. Report sensitive issues (RCE, LFI, Token leakage) confidentially via [Security Advisories](https://github.com/sentinal404/MeriAwaaz-Streaming-Platform/security/advisories/new).
- Complete policies and bug bounty disclosures in our [SECURITY.md](SECURITY.md).

---

## 📜 License

Licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.

---

<div align="center">
  <b>Meri Awaaz (मेरी आवाज़)</b> — Decentralized Video, Cinema & Community Media<br>
  <i>Crafted with ❤️ by <a href="https://github.com/sentinal404">Rishi Shakya</a> • <a href="https://www.linkedin.com/in/rishishakya">LinkedIn</a></i>
</div>

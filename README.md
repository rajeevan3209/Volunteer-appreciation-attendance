# Volunteer Appreciation Attendance App

A full-stack attendance tracking application for the **Volunteer Appreciation Dinner** at Pasir Ris West Community Centre.

---

## Pages & URLs

Replace `your-app` with your actual Railway domain (e.g. `volunteer-attendance-production.up.railway.app`).

| Page | URL | Description |
|---|---|---|
| **Mark Attendance** | `https://volunteer-appreciation-dinner-pasir-ris-west.up.railway.app/` | Main page — select sub-committee, search participant, mark attendance |
| **Attendees List** | `https://volunteer-appreciation-dinner-pasir-ris-west.up.railway.app/attendees` | View all attended participants grouped by sub-committee, export to Excel |
| **Tree of Names** | `https://volunteer-appreciation-dinner-pasir-ris-west.up.railway.app/tree` | Live tree display — names appear on the tree as attendance is marked |
| **Lucky Draw** | `https://volunteer-appreciation-dinner-pasir-ris-west.up.railway.app/lucky-draw` | Spin wheel lucky draw using attended participants |

---

## How Each Page Works

### Mark Attendance (`/`)
1. Select a **Sub-Committee** from the dropdown
2. Search and select a **Participant Name**
3. Click **Mark Attendance**
4. A confirmation dialog appears — click **Confirm**
5. A thank you screen is shown — click 👍 to close

### Attendees List (`/attendees`)
- Shows all attended participants grouped by sub-committee
- Displays total count and number of sub-committees
- Click **↺** to refresh live data
- Click **⬇** to export attendance as an Excel file (`attendance.xlsx`)

### Tree of Names (`/tree`)
- Displays a tree with volunteer names on the canopy
- Names appear automatically every 5 seconds as attendance is marked
- Click **⤢** (bottom-right of tree) to go fullscreen — great for a display screen at the event
- Press **Esc** to exit fullscreen

### Lucky Draw (`/lucky-draw`)
- Wheel is populated with all attended participants
- Click **🎡 SPIN** to spin the wheel
- Winner popup appears with name and sub-committee
- **Remove from wheel** — adds winner to the side panel and removes from wheel
- **Keep & spin again** — dismisses popup, winner stays on wheel
- Winners panel on the right lists all winners, newest at the top
- Click **Clear all** to reset the winners list and restore the wheel

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6 |
| Backend | Spring Boot 3.2 (Java 17) |
| Database | PostgreSQL (Railway) / H2 (local dev) |
| Hosting | Railway |
| Build | Docker (multi-stage) |

---

## Project Structure

```
attendance-app/
├── backend/                          # Spring Boot API
│   ├── src/main/java/com/volunteer/attendance/
│   │   ├── controller/               # REST endpoints
│   │   ├── entity/                   # Participant, Attendance
│   │   ├── repository/               # JPA repositories
│   │   ├── service/                  # Business logic
│   │   └── config/                   # DataLoader, WebConfig
│   └── src/main/resources/
│       ├── application.properties    # Local (H2) config
│       ├── application-prod.properties # Production (PostgreSQL) config
│       └── participants.csv          # Source participant data
├── frontend/                         # React app
│   └── src/
│       ├── App.js                    # Mark attendance page
│       ├── Attendees.js              # Attendees list page
│       ├── TreePage.js               # Tree of names page
│       └── LuckyDraw.js              # Lucky draw wheel page
├── Dockerfile                        # Multi-stage build
├── railway.json                      # Railway deployment config
└── build.sh                          # Local build script
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/subcommittees` | List all sub-committees |
| `GET` | `/api/participants?subCommittee=X` | List participants for a sub-committee (with attended flag) |
| `POST` | `/api/attendance` | Mark attendance `{ participantName, subCommittee }` |
| `GET` | `/api/attendance` | Get all attendance records |

---

## Railway Deployment

### Access the Dashboard
1. Go to [railway.app](https://railway.app)
2. Log in with your GitHub account
3. Select the **volunteer-attendance** project

### Services in the Project
| Service | What it is |
|---|---|
| **web** | The Spring Boot + React application |
| **PostgreSQL** | The database storing attendance records |

### Checking the Database
1. Click the **PostgreSQL** service
2. Click the **Data** tab
3. Select the `attendance` or `participants` table to view records

Or connect via psql from the **Connect** tab:
```sql
SELECT * FROM attendance ORDER BY marked_at DESC;
SELECT COUNT(*) FROM attendance;
SELECT sub_committee, COUNT(*) FROM attendance GROUP BY sub_committee ORDER BY COUNT(*) DESC;
```

### Environment Variables (web service)
| Variable | Value |
|---|---|
| `SPRING_PROFILES_ACTIVE` | `prod` |
| `PGHOST` | Auto-injected from PostgreSQL plugin |
| `PGPORT` | Auto-injected from PostgreSQL plugin |
| `PGDATABASE` | Auto-injected from PostgreSQL plugin |
| `PGUSER` | Auto-injected from PostgreSQL plugin |
| `PGPASSWORD` | Auto-injected from PostgreSQL plugin |

### Redeploying After Changes
```bash
git add .
git commit -m "Your change description"
git push
```
Railway auto-detects the push and redeploys. Takes ~3–5 minutes.

### Viewing Logs
1. Click the **web** service
2. Click **Deploy Logs** — shows app startup and errors
3. Click **HTTP Logs** — shows incoming requests

---

## Local Development

### Prerequisites
- Java 17+
- Maven 3.8+
- Node.js 18+

### Run Locally
```bash
# Terminal 1 — Backend (uses H2 in-memory DB)
cd backend
mvn spring-boot:run

# Terminal 2 — Frontend (proxies /api calls to :8080)
cd frontend
npm install
npm start
```

App runs at `http://localhost:3000`
H2 console available at `http://localhost:8080/h2-console`

### Build Production JAR
```bash
chmod +x build.sh && ./build.sh
java -jar backend/target/attendance-app-1.0.0.jar
```

---

## Updating Participant List

1. Edit `backend/src/main/resources/participants.csv`
2. Format: `Name,SubCommittee` (one per line, first line is header)
3. Push to GitHub — Railway redeploys automatically
4. On first boot with an empty `participants` table, the CSV is loaded automatically

> **Note:** If participants are already in the database, the CSV loader skips re-seeding. To force a reload, clear the `participants` table via Railway's Data tab first.

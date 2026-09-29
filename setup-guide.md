# CricBid - Modern Multi-Tournament Cricket Auction Platform Setup Guide

CricBid is a modern, real-time cricket auction platform built for multi-tournament management. It features live spectator stages, franchise owner bidding consoles, an admin control center, and real-time synchronization backed by Google Sheets and Firebase Realtime Database.

---

## Architecture Overview (Vite + React SPA)

- **`src/pages/TournamentHub.jsx`** — **CricBid Gateway**: Central tournament gateway and tournament cards.
- **`src/pages/TeamLogin.jsx`** — **CricBid Team Login & Owner Console**: Franchise owner portal for real-time bid placement, purse monitoring, and squad tracking (renamed from `team-view` to `team-login`, with event dropdown and fullscreen removed).
- **`src/pages/PublicDashboard.jsx`** — **CricBid Spectator Stage**: Large-screen broadcast display showing current bidding player, timer, bids, and team rosters.
- **`src/pages/PlayerExplorer.jsx`** — **CricBid Player Explorer**: Player catalog, stats, and real-time status badges.
- **`src/pages/Admin.jsx`** — **CricBid Admin Console**: Tournament manager, team creator, registered players with Google Drive photo upload, and live auction controller.
- **`legacy_html/`** — Safe backup of original standalone HTML files.

---

## Step 1: Deploy the Google Apps Script Backend

1. Open your Google Spreadsheet:
   `https://docs.google.com/spreadsheets/d/1AMSfb5V9mIoSUSCOBz_eO86hp04XGa4UN5LX01DDiSw/edit`

2. Go to **Extensions > Apps Script**

3. Delete any existing code in `Code.gs`

4. Copy the entire contents of **`google-apps-script.gs`** and paste it into the editor

5. Click **Save** (Ctrl+S)

6. Click **Deploy > New deployment**

7. Click the gear icon next to "Select type" and choose **Web app**

8. Set these options:
   - Description: `CricBid Auction API`
   - Execute as: **Me**
   - Who has access: **Anyone**

9. Click **Deploy**

10. **Authorize** when prompted (click through the "unsafe" warning — it's your own script)

11. Copy the **Web app URL** — it looks like:
    `https://script.google.com/macros/s/AKfycb.../exec`

---

## Step 2: Configure Firebase Realtime Database

1. Go to **https://console.firebase.google.com**

2. Click **Add project** (or use an existing project)

3. Give it a name like `cricbid-auction` and click **Continue**

4. Disable Google Analytics (optional) and click **Create project**

5. In the left sidebar, click **Build > Realtime Database**

6. Click **Create Database**, select a region, and choose **Start in test mode**

7. Go to the **Rules** tab and set:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

8. Copy the **Database URL** — it looks like:
   `https://cricbid-xxxxx-default-rtdb.firebaseio.com`

---

## Step 3: Configure `config.json`

Ensure your `config.json` file in the root folder contains your settings:
```json
{
  "sheet_id": "1AMSfb5V9mIoSUSCOBz_eO86hp04XGa4UN5LX01DDiSw",
  "apps_script_url": "YOUR_APPS_SCRIPT_WEB_APP_URL",
  "firebase_url": "https://YOUR_DATABASE_NAME.firebaseio.com",
  "drive_base_folder_id": "1YdBiEy8ENXQOmuVJy6lxvpDSbQXYOyKn",
  "drive_base_folder_url": "https://drive.google.com/drive/folders/1YdBiEy8ENXQOmuVJy6lxvpDSbQXYOyKn"
}
```

---

## Step 4: Google Drive Storage & Permissions Setup (Do's & Best Practices)

CricBid uploads event banners and team logos directly to your Google Drive base folder:
**`https://drive.google.com/drive/folders/1YdBiEy8ENXQOmuVJy6lxvpDSbQXYOyKn`** (ID: `1YdBiEy8ENXQOmuVJy6lxvpDSbQXYOyKn`).

### 1. Drive Folder Structure
The app automatically creates and manages subfolders:
```
Base Folder (1YdBiEy8ENXQOmuVJy6lxvpDSbQXYOyKn)/
├── <EventCode>/               (e.g., ESL2026)
│   ├── banner.png / banner.jpg
│   ├── Teams/
│   │   ├── <TeamName>.png     (e.g., Eminent Wolves.png)
│   │   └── <TeamName>.png     (e.g., Super Strikers.png)
│   └── players/
│       ├── <PlayerName>.png   (e.g., Rahul Sharma.png)
│       └── <PlayerName>.jpg   (e.g., Virat Kohli.jpg)
└── [Your Google Sheet Data]   (e.g., CricBid Auction Data)
```

### 2. Necessary "Do's" to Make Base Directory Accessible for the App
- **Do: Share Base Folder as Public Viewer**
  - Right-click the folder in Google Drive > **Share** > **General access**.
  - Change from **"Restricted"** to **"Anyone with the link"** and set role as **"Viewer"**.
  - *Why?* Images (banners and team logos) stored here can be viewed by all spectators, teams, and public dashboards without asking viewers to sign into Google.
- **Do: Grant Editor/Owner Permission to the Script Owner**
  - Ensure the Google account deploying the Google Apps Script has **"Editor"** or **"Owner"** access to this folder so the backend has permission to create subfolders and write files.
- **Do: Move the Google Sheet into this Folder Safely**
  - You can move your Google Sheet (`1AMSfb5V9mIoSUSCOBz_eO86hp04XGa4UN5LX01DDiSw`) directly into this folder.
  - Moving the file inside Google Drive does **NOT** alter its Spreadsheet ID, so all Apps Script connections, Google Visualization queries, and frontend features will continue working seamlessly.
  - Inheriting folder viewer permissions will also ensure spectator and team boards can read attendee lists securely.
- **Do: Re-deploy Google Apps Script after Updating Code**
  - When updating `google-apps-script.gs` with the upload code:
    1. Open **Extensions > Apps Script**.
    2. Paste the updated `google-apps-script.gs` code and click **Save**.
    3. Click **Deploy > Manage deployments**.
    4. Click the **Pencil (Edit)** icon next to the active deployment.
    5. Set **Version** to **"New version"**.
    6. Click **Deploy**.
    7. If prompted for Drive permissions ("Review permissions"), click **Allow** (authorizes `DriveApp` to create folders and upload files).

---

## Step 5: Google Spreadsheet Structure

- **`Events`** — Stores event metadata:
  - Columns: `Event Name`, `Event Code`, `Start Date`, `End Date`, `Venue`, `Registration Fee`, `Event Contacts`, `Banner URL`, `Status`
- **`Attendee List`** — Stores registered players:
  - Includes **`EventCode`** column (e.g. `ESL2026`, `EC2026`, or `ALL`).
- **`Teams`** — Stores registered teams:
  - Columns: `Team Name`, `Logo URL`, `Owner Name`, `Icon Player`, `Username`, `Password`, `Purse Remaining`, `Max Players`, **`EventCode`**.
- **`Settings`** — Contains admin access code and default auction settings.
- **`AuctionLog`** — Real-time record of all sold and unsold bids per tournament.

---

## Step 6: Running CricBid React App
 
Run the Vite development server:
```bash
npm run dev
```
Open **`http://localhost:3000/`** to access the CricBid React App.

To build the production bundle:
```bash
npm run build
```

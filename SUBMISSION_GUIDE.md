# Submission Guide — Exp 10 Project Report

Everything the code/report needs is already in this folder. This guide covers the few
steps that only **you** can finish (hosting, video, and your own tool screenshots).

## 1. Run the app locally (to demo / screenshot)
```bash
npm install     # one time
npm start       # then open http://localhost:3000
```
Log in as **admin@rmms.io / admin123** (admin) or **aaron@rmms.io / aaron123** (user).

> ⚠️ **OneDrive note:** running Node from inside a OneDrive-synced folder usually works, but if
> you ever see a permission/`EPERM` error, copy this folder somewhere outside OneDrive
> (e.g. `C:\Projects\rmms`) and run it there.

## 2. Put the code on GitHub (Git is not installed on this PC yet)
**Easiest — GitHub Desktop:**
1. Install **GitHub Desktop** from https://desktop.github.com and sign in.
2. File → **Add Local Repository** → choose this `SOFTWARE PROJECT` folder →
   "create a repository here" → Publish. Keep it **Public** (or add your faculty as a collaborator).
3. The included `.gitignore` already excludes `node_modules/` and the local database.

**Or install Git** (https://git-scm.com/download/win), then in this folder:
```bash
git init
git add .
git commit -m "Robot Manipulator Management System"
git branch -M main
git remote add origin https://github.com/<your-username>/robot-manipulator-management-system.git
git push -u origin main
```
Then **paste the repo URL into Appendix A** of the report (both `REPORT.md` and the `.docx`).

## 3. Record the demo video
- Record a 2–4 min screen capture (Windows **Xbox Game Bar: Win+G**, or OBS) walking through:
  login → dashboard → browse/filter robots → robot detail → reserve → release → admin manage/maintenance → users.
- Upload to **Google Drive**, set sharing to **"Anyone with the link can view"**, and
  **test it in an incognito window**. Paste the link into Appendix A.

## 4. Add your own tool screenshots to the report (§7)
The report already contains the application screenshots and all diagrams. For the "Software Tools"
section, add these captures where it says `[INSERT SCREENSHOT]`:
- **7.1 VS Code** — this project open in VS Code.
- **7.2 GitHub** — your published repo page (after step 2).
- **7.5 Postman / DevTools** — a request such as `POST /api/auth/login` returning 200 + token
  (import the endpoints from the table in README, or use the browser DevTools → Network tab).
- (Optional) **7.3** — your terminal showing `npm start`.

## 5. Final checklist (from the assignment)
- [ ] GitHub repo is public (or shared with faculty) and has a README with setup steps ✅ (README included)
- [ ] Drive video link opens in incognito without requesting access
- [ ] At least three tools shown with screenshots, purpose and usage ✅ (five documented; add captures)
- [ ] Report submitted (`report/RMMS_Project_Report.docx`) and/or `REPORT.md`

## What's already done for you
- ✅ Full working software (backend + frontend + database) — `npm start`
- ✅ 14 automated tests passing — `npm test`
- ✅ README with setup steps
- ✅ Report in **Word** (`report/RMMS_Project_Report.docx`) and **Markdown** (`REPORT.md`)
- ✅ All UML/ER diagrams (`docs/diagrams/`) and app screenshots (`docs/screenshots/`)

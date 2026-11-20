# Kampala Community Clinic

The dashboard opens directly for local coursework with fictional data. All changes are attributed to “Local demo” in the audit log.

| Folder | Contents |
| --- | --- |
| `frontend` | Dashboard HTML, CSS and browser JavaScript |
| `backend` | Express server, MongoDB configuration, sample data and tests |

## Run on Windows

Install Node.js 18 or later and start MongoDB Community Server 7.0 or later. Extract this ZIP, open Command Prompt in the project folder, and run:

```bat
cd backend
npm ci
npm run seed
npm start
```

Open http://localhost:3000 in your browser. Express serves the frontend and API on the same port. Leave the terminal running while using the dashboard.

The default database is `health_clinic_db_demo`. To use an existing coursework database, set `DB_NAME` in the terminal before starting the app, for example `set DB_NAME=health_clinic_db` in CMD. Seeding adds missing fictional sample records. Use fictional records only and keep the app on your own computer.

Run `npm run check` and `npm test` from `backend` to verify the project files.

## Submit and review on GitHub

Commit the contents of this folder as the repository root. The GitHub repository should show `frontend/`, `backend/`, `.github/`, and this README at the top level. Submit the repository URL. If the repository is private, invite your lecturer and make sure they accept before the submission deadline. For a public repository, open its URL in a signed-out browser window to confirm it is accessible.

Your lecturer can use **Code → Download ZIP** or clone the repository, then follow the installation steps above. A quick check in the browser is to open **Patients** and confirm that ten fictional records appear after seeding a fresh database.

The **Actions → Verify clinic app** workflow installs dependencies, runs the tests, starts an isolated MongoDB instance, seeds it, and verifies the dashboard and the patient API. It runs after a push when Actions is enabled. The workflow result is available under the repository’s **Actions** tab.

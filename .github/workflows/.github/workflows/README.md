# Sila Matchmaking Ritual (GitHub Actions)

This runs your matching algorithm every Friday at 6:00 PM IST using a free GitHub Actions scheduled workflow.

## How it works

1. GitHub Actions starts on schedule
2. Runs `matchmaking.js`
3. Reads all users from Firestore
4. Computes compatibility scores
5. Writes top matches to each user's `matches/{portal}` document

## Setup instructions

### 1. Create a GitHub repository

Go to [github.com/new](https://github.com/new) and create a **private** repository.

Name it something like `sila-matchmaking`.

### 2. Upload these files to the repo

Upload these files to the root of your new repo:

```text
package.json
matchmaking.js
.github/workflows/matchmaking.yml
```

### 3. Create a Firebase service account

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project `sila-updated`
3. Click the ⚙️ gear icon → **Project settings**
4. Go to the **Service accounts** tab
5. Click **Generate new private key**
6. A JSON file will download. Keep it safe.

### 4. Add the service account to GitHub Secrets

1. Open your GitHub repo
2. Go to **Settings → Secrets and variables → Actions**
3. Click **New repository secret**
4. Name: `FIREBASE_SERVICE_ACCOUNT`
5. Value: Open the downloaded JSON file, copy **all** its contents, and paste it here
6. Click **Add secret**

### 5. Test it manually

1. Go to your GitHub repo
2. Click **Actions** tab
3. Click **Sila Matchmaking Ritual** on the left
4. Click **Run workflow**
5. Click **Run workflow** again

After a few minutes, check if it completed successfully. If it failed, click the failed run and read the error message.

### 6. Check the result in Firestore

Go to Firebase Console → Firestore Database → `users/{userId}/matches/romance` and `users/{userId}/matches/friends`.

You should see match documents with top matches.

## Important notes

- Keep the repository **private**. The service account key is powerful.
- The service account bypasses Firestore security rules. This is fine for a backend script.
- The free GitHub Actions tier gives you 2000 minutes per month. This script runs once per week and uses only a few minutes per month.
- The schedule runs every Friday at 6:00 PM IST.

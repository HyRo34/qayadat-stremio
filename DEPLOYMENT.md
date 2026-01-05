# Hosting Permanently on Render (Free)

## Step 0: Fix Git Identity (Required once)
If you see "Author identity unknown" error, run these commands in your terminal:
```bash
git config --global user.email "you@example.com"
git config --global user.name "Your Name"
```
*(You can use your real email/name or fake ones, it doesn't matter for this)*

## Step 1: Push to GitHub
1.  Create a fresh repository on [GitHub](https://github.com/new) (e.g., "qayadat-stremio").
2.  Open your terminal in this project folder (`c:\Users\Safee\OneDrive\Desktop\PROJECTS\turikishshowaddon`) and run:
    ```bash
    git add .
    git commit -m "Initial commit"
    git branch -M main
    git remote add origin https://github.com/YOUR_USERNAME/qayadat-stremio.git
    git push -u origin main
    ```
    *(If `remote origin already exists`, verify it matches your new repo)*

## Step 2: Deploy to Render
1.  Go to [Render.com](https://render.com) and sign up (using GitHub is easiest).
2.  Click **"New +"** -> **"Web Service"**.
3.  Select **"Build and deploy from a Git repository"** and choose your new `qayadat-stremio` repo.
4.  **Configure the service**:
    - **Name**: `qayadat-stremio`
    - **Region**: Choose one close to you.
    - **Branch**: `main`
    - **Runtime**: `Node`
    - **Build Command**: `npm install`
    - **Start Command**: `npm start`
    - **Instance Type**: `Free`
5.  Click **"Create Web Service"**.

## Step 3: Get Your Public Link
1.  Wait for the deployment to finish (~1-2 mins).
2.  Copy the URL (e.g., `https://qayadat-stremio.onrender.com`).
3.  Add `/manifest.json` to the end.
    - Final Link: `https://qayadat-stremio.onrender.com/manifest.json`
4.  Paste this link into Stremio on your Phone, TV, or PC.

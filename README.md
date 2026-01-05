# Qayadat Stremio Addon

This addon scrapes Turkish shows from [Qayadat Play](https://play.qayadat.org) and provides high-quality direct streams via Pixeldrain.

## Prerequisites
- Node.js installed.
- Stremio installed.

## Installation

1.  **Start the Addon Server**:
    Open a terminal in this directory (`c:\Users\Safee\OneDrive\Desktop\PROJECTS\turikishshowaddon`) and run:
    ```bash
    npm start
    ```
    You should see: `Addon running on http://localhost:7000`

2.  **Add to Stremio**:
    - Open Stremio.
    - Go to the **Add-ons** page.
    - In the search bar (or "Add Addon URL"), type:
      `http://localhost:7000/manifest.json`
    - Click **Install**.

## Sharing with Other Devices (Phone, TV)

To use this addon on other devices:

1.  Keep the addon running (`npm start`) in one terminal.
2.  Open a **new terminal** and run:
    ```bash
    npm run share
    ```
3.  Copy the URL it gives you (e.g., `https://random-name.loca.lt`).
4.  Add `/manifest.json` to the end (e.g., `https://random-name.loca.lt/manifest.json`).
5.  Paste this link into the search bar of Stremio on your Phone or TV.

## Usage
- Search for supported Turkish shows (e.g., "Kurulus Osman", "Alparslan", "Teskilat").
- Select an episode (e.g., Season 1 Episode 9).
- You should see streams labeled **"Qayadat Play"**.

## Supported Shows
See `mapping.json` for the full list of manually mapped shows.
- Kurulus Osman
- Uyanis Buyuk Selcuklu
- Destan
- Teskilat
- Mehmed Fetihler Sultani
- And more...

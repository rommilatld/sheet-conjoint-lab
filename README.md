# Plan Builder by Experiment Nation

A stateless conjoint analysis application that uses Google Sheets as the backend. Create surveys, collect responses, and generate pricing plans based on conjoint analysis.

## Project info

**URL**: https://lovable.dev/projects/fe1b2a15-37a2-4db1-bbdb-6fb15b2ac3ec

## Setup Instructions

**If you're copying this project to run your own instance**, you need to configure it with your own Google Cloud service account.

📖 **See [SETUP.md](SETUP.md) for complete step-by-step setup instructions**

✅ **See [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for a quick checklist**

### Quick Setup Summary

1. Create a Google Cloud service account with Sheets API access
2. Add three secrets to Lovable Cloud:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
   - `ENCRYPTION_SECRET`
3. Update the service account email in `src/pages/StartProject.tsx`
4. Deploy and test!

**Estimated setup time:** 15-30 minutes

## How the App Works

1. **Stateless Architecture**: No database - all data lives in users' Google Sheets
2. **Creator Workflow**: 
   - Start new project by connecting a Google Sheet
   - Define attributes and pricing levels
   - Preview survey design
   - Generate encrypted survey links
   - Run conjoint analysis on responses
3. **Respondent Workflow**: 
   - Access survey via encrypted link
   - Complete choice tasks
   - Responses saved directly to Google Sheet
4. **Analysis**: 
   - MNL/logit model estimates utilities
   - Generates pricing plans with recommendations
   - Exports results to PDF

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/fe1b2a15-37a2-4db1-bbdb-6fb15b2ac3ec) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/fe1b2a15-37a2-4db1-bbdb-6fb15b2ac3ec) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

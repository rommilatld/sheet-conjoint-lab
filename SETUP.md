# Setup Guide for Plan Builder

This guide will walk you through setting up your own instance of Plan Builder by Experiment Nation.

## Prerequisites

- A Google Cloud account (free tier is sufficient)
- A Lovable account with Cloud enabled
- Basic familiarity with Google Cloud Console

## Step-by-Step Setup

### Part 1: Google Cloud Configuration

#### 1.1 Create a Google Cloud Project

1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top
3. Click "New Project"
4. Enter a project name (e.g., "Plan Builder")
5. Click "Create"

#### 1.2 Enable Google Sheets API

1. In your Google Cloud project, go to "APIs & Services" > "Library"
2. Search for "Google Sheets API"
3. Click on it and press "Enable"
4. Wait for the API to be enabled (usually takes a few seconds)

#### 1.3 Create a Service Account

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" at the top
3. Select "Service Account"
4. Fill in the details:
   - **Service account name**: `conjoint-sheets-access` (or your preferred name)
   - **Service account ID**: Will auto-populate
   - **Description**: "Service account for Plan Builder to access Google Sheets"
5. Click "Create and Continue"
6. **Grant this service account access to project**: Skip this step, click "Continue"
7. **Grant users access to this service account**: Skip this step, click "Done"

#### 1.4 Generate Service Account Key

1. In the Credentials page, you'll see your service account listed under "Service Accounts"
2. Click on the service account email to open its details
3. Go to the "Keys" tab
4. Click "Add Key" > "Create New Key"
5. Select "JSON" format
6. Click "Create"
7. A JSON file will download automatically - **keep this file safe!**

#### 1.5 Note Your Service Account Email

Open the downloaded JSON file and find the `client_email` field. It will look something like:
```
conjoint-sheets-access@your-project-name.iam.gserviceaccount.com
```

**Save this email - you'll need it for the app setup and users will need to share their sheets with this email.**

### Part 2: Lovable Cloud Configuration

#### 2.1 Open Your Lovable Project

1. Go to your Plan Builder project in Lovable
2. Make sure Lovable Cloud is enabled
   - If not, go to Settings > Cloud and enable it

#### 2.2 Add Required Secrets

You need to add three secrets. Go to your project and use the Cloud interface to add secrets:

**Secret 1: GOOGLE_SERVICE_ACCOUNT_EMAIL**
- Value: The `client_email` from your JSON file
- Example: `conjoint-sheets-access@your-project-name.iam.gserviceaccount.com`

**Secret 2: GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY**
- Value: The entire `private_key` field from your JSON file
- **Important**: Copy the entire value including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines
- Make sure to preserve all line breaks in the key

**Secret 3: ENCRYPTION_SECRET**
- Value: A random 32+ character string
- You can generate one using:
  - Online password generator (use 32+ characters, include letters, numbers, symbols)
  - Command line: `openssl rand -base64 32`
  - Or any secure random string generator
- Example: `K8j3mP9qR2vX5nY7bT4wE1zL6hS0cA3f`

**Important Notes:**
- Never commit these secrets to your code repository
- Keep the JSON file secure - it grants access to your service account
- If you ever suspect the secrets are compromised, regenerate them immediately

### Part 3: Update the App

#### 3.1 Update the Service Account Email in Code

The app displays instructions to users about which email to share their Google Sheets with. You need to update this in the code:

1. Open `src/pages/StartProject.tsx`
2. Find line 20 where `serviceAccountEmail` is defined
3. Replace the email with YOUR service account email:
   ```typescript
   const serviceAccountEmail = "your-service-account@your-project.iam.gserviceaccount.com";
   ```

#### 3.2 Deploy Your Changes

1. In Lovable, make sure all changes are saved
2. Click "Publish" to deploy your app
3. Your app is now ready to use!

### Part 4: Testing Your Setup

#### 4.1 Create a Test Google Sheet

1. Create a new Google Sheet in your Google account
2. Name it "Plan Builder Test"
3. Share it with your service account email (the one you configured)
4. Give it **Editor** permissions

#### 4.2 Test the App

1. Go to your deployed app
2. Click "Start New Project"
3. Follow the instructions and paste your test sheet URL
4. If everything is configured correctly, the app will create the required tabs in your sheet
5. You should receive a project key

If you encounter any errors, double-check:
- All three secrets are correctly set in Lovable Cloud
- The Google Sheets API is enabled
- The sheet is shared with the correct service account email
- The service account has Editor permissions on the sheet

## Troubleshooting

### "Failed to initialize project"
- Check that the Google Sheets API is enabled in your Google Cloud project
- Verify the sheet is shared with the service account email with Editor permissions
- Check that all secrets are correctly configured in Lovable Cloud

### "Invalid credentials" or authentication errors
- Verify that `GOOGLE_SERVICE_ACCOUNT_EMAIL` matches the `client_email` in your JSON file
- Ensure `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` includes the full key with BEGIN and END markers
- Check for any extra spaces or line breaks when copying the private key

### "Encryption error" or "Failed to generate project key"
- Verify that `ENCRYPTION_SECRET` is set and is at least 32 characters long
- Make sure the secret doesn't contain any special characters that might cause issues

## Security Best Practices

1. **Protect Your Secrets**: Never commit the JSON file or secrets to version control
2. **Limit Service Account Permissions**: The service account only needs Google Sheets API access
3. **Regular Rotation**: Consider rotating your service account keys periodically
4. **Monitor Usage**: Check your Google Cloud project for unusual API usage
5. **Use Environment-Specific Keys**: Consider using different service accounts for development and production

## Sharing Your App

When sharing this app with others who want to run their own instance:

1. Share this SETUP.md file
2. Share the README.md with the overview
3. Do NOT share:
   - Your service account JSON file
   - Your configured secrets
   - Your specific service account email (they need to create their own)

Each person who wants to run this app needs to:
1. Create their own Google Cloud service account
2. Configure their own secrets in their Lovable project
3. Update the service account email in the code
4. Deploy their own instance

## Need Help?

If you encounter issues not covered in this guide:
1. Check the Lovable documentation on Cloud and Secrets
2. Review Google Cloud's service account documentation
3. Check the edge function logs in Lovable Cloud for specific error messages

## Summary Checklist

- [ ] Google Cloud project created
- [ ] Google Sheets API enabled
- [ ] Service account created
- [ ] Service account JSON key downloaded
- [ ] GOOGLE_SERVICE_ACCOUNT_EMAIL secret added to Lovable Cloud
- [ ] GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY secret added to Lovable Cloud
- [ ] ENCRYPTION_SECRET secret added to Lovable Cloud
- [ ] Service account email updated in StartProject.tsx
- [ ] App deployed
- [ ] Test sheet created and shared
- [ ] Test project created successfully

Once all items are checked, your Plan Builder instance is ready to use!

# Deployment Checklist for Plan Builder

Use this checklist when setting up your own instance of Plan Builder.

## ✅ Pre-Deployment Checklist

### Google Cloud Setup
- [ ] Google Cloud account created
- [ ] New Google Cloud project created (or existing project selected)
- [ ] Google Sheets API enabled for the project
- [ ] Service account created with a descriptive name
- [ ] Service account JSON key downloaded and stored securely
- [ ] Service account email noted (format: `name@project.iam.gserviceaccount.com`)

### Lovable Cloud Setup
- [ ] Lovable project created or copied
- [ ] Lovable Cloud enabled on the project
- [ ] Three secrets configured in Cloud settings:
  - [ ] `GOOGLE_SERVICE_ACCOUNT_EMAIL` - from JSON file's `client_email`
  - [ ] `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` - from JSON file's `private_key` (include BEGIN/END markers)
  - [ ] `ENCRYPTION_SECRET` - random 32+ character string

### Code Updates
- [ ] Service account email updated in `src/pages/StartProject.tsx` (line 20-23)
- [ ] All changes committed
- [ ] Project published/deployed

### Testing
- [ ] Test Google Sheet created
- [ ] Test sheet shared with service account email with Editor permissions
- [ ] Attempted to create a test project
- [ ] Verified project key was generated
- [ ] Verified tabs were created in the Google Sheet
- [ ] Created test attributes
- [ ] Generated test survey link
- [ ] Completed test survey response
- [ ] Ran test analysis

## 🔒 Security Verification

- [ ] Service account JSON file is NOT committed to repository
- [ ] `.env` files are NOT committed (if any exist locally)
- [ ] Secrets are only stored in Lovable Cloud, not in code
- [ ] Service account has minimal required permissions (only Google Sheets API)
- [ ] Production and development use separate service accounts (recommended)

## 📝 Documentation Updates

- [ ] Updated `src/pages/StartProject.tsx` with your service account email
- [ ] Created internal documentation for your team (if applicable)
- [ ] Noted where secrets are stored for your organization

## 🚀 Post-Deployment

- [ ] App is accessible at your deployment URL
- [ ] Test project workflow from start to finish
- [ ] Error handling tested (try without sharing sheet with service account)
- [ ] Documentation shared with relevant team members
- [ ] Service account JSON file stored securely (password manager, vault, etc.)
- [ ] Added calendar reminder to review/rotate credentials (optional, recommended every 6-12 months)

## 🆘 Troubleshooting Reference

If you encounter issues during setup:

| Error Message | Likely Cause | Solution |
|--------------|--------------|----------|
| "Missing Google service account credentials" | Secrets not configured | Add GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in Cloud settings |
| "Missing ENCRYPTION_SECRET" | Secret not configured | Add ENCRYPTION_SECRET (32+ characters) in Cloud settings |
| "Failed to initialize project" | Sheet not shared or API not enabled | Share sheet with service account email, verify Google Sheets API is enabled |
| "Invalid credentials" | Wrong email or malformed private key | Double-check secret values, ensure private key includes BEGIN/END markers |
| "Failed to get access token" | Service account misconfigured | Verify service account exists and has not been deleted |

## 📄 Files to Reference

- **SETUP.md** - Detailed step-by-step setup instructions
- **README.md** - Overview and high-level information
- **src/pages/StartProject.tsx** - Where to update service account email

## 🎯 Success Criteria

Your deployment is successful when:
1. ✅ You can create a new project with a Google Sheet URL
2. ✅ The app generates a project key
3. ✅ Required tabs are automatically created in the sheet
4. ✅ You can add attributes and levels
5. ✅ Survey links can be generated
6. ✅ Survey responses are saved to the sheet
7. ✅ Analysis runs successfully and generates plans

---

**Time Estimate:** 15-30 minutes for first-time setup

**Difficulty:** Intermediate (requires familiarity with Google Cloud Console)

**Support:** See SETUP.md for detailed instructions and troubleshooting

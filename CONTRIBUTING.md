# Contributing & Customization Guide

This guide is for developers who want to customize or extend Plan Builder for their own use cases.

## Project Structure

```
plan-builder/
├── src/
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   └── workspace/             # Workspace-specific components
│   ├── pages/                     # Main page components
│   │   ├── Index.tsx              # Landing page
│   │   ├── StartProject.tsx       # New project creation
│   │   ├── OpenProject.tsx        # Existing project access
│   │   ├── Workspace.tsx          # Main workspace interface
│   │   └── SurveyResponse.tsx     # Survey respondent view
│   ├── lib/                       # Utility functions
│   └── index.css                  # Global styles and design tokens
├── supabase/
│   └── functions/                 # Edge functions
│       ├── _shared/               # Shared utilities
│       ├── init-project/          # Project initialization
│       ├── get-attributes/        # Fetch attributes
│       ├── save-attributes/       # Save attributes
│       ├── get-sheet-info/        # Validate sheet access
│       ├── generate-survey-link/  # Create survey URLs
│       ├── load-survey/           # Load survey for respondents
│       ├── submit-survey-response/# Save responses
│       ├── run-analysis/          # Conjoint analysis
│       └── get-surveys/           # List all surveys
└── docs/
    ├── SETUP.md                   # Setup instructions
    ├── DEPLOYMENT_CHECKLIST.md    # Quick reference
    └── CONTRIBUTING.md            # This file

```

## Architecture Overview

### Stateless Design
- **No database**: All data lives in users' Google Sheets
- **Encryption**: Project keys and survey tokens encrypt sheet IDs
- **Edge functions**: All backend logic runs on Lovable Cloud

### Key Components

1. **Encryption Layer** (`supabase/functions/_shared/google-sheets.ts`)
   - Project key encryption/decryption
   - Survey token generation
   - Uses AES-GCM encryption

2. **Google Sheets Integration** (`supabase/functions/_shared/google-sheets.ts`)
   - Service account authentication
   - JWT token generation
   - Google Sheets API calls

3. **Conjoint Analysis** (`supabase/functions/run-analysis/index.ts`)
   - MNL/logit model implementation
   - Utility estimation
   - Price optimization
   - Plan generation

4. **Survey System**
   - Design generation (fractional factorial)
   - Response collection
   - Link encryption

## Common Customizations

### 1. Change the Branding

**Update app name and logo:**
- `src/pages/Index.tsx` - Landing page branding
- `src/pages/StartProject.tsx` - Project creation page
- `src/pages/Workspace.tsx` - Workspace header
- `public/favicon.jpg` - Replace with your logo

**Update colors:**
- `src/index.css` - Design system tokens
- `tailwind.config.ts` - Tailwind theme configuration

### 2. Modify Analysis Algorithm

The conjoint analysis is in `supabase/functions/run-analysis/index.ts`:

```typescript
// Key functions to customize:
- estimateUtilities()      // MNL estimation logic
- generatePlans()          // Plan generation and pricing
- calculateImportance()    // Attribute importance calculation
```

**Common modifications:**
- Change the number of optimization iterations
- Adjust pricing strategies
- Add new analysis outputs
- Modify plan generation logic

### 3. Add New Attribute Types

Currently supports text and pricing attributes. To add new types:

1. **Update AttributesTab.tsx:**
```typescript
// Add new attribute type
type AttributeType = 'text' | 'price' | 'image' | 'color';

// Add UI for new type selection
// Add type-specific input handling
```

2. **Update Google Sheets structure:**
   - Add new columns in Attributes tab
   - Update save-attributes and get-attributes functions

3. **Update survey display:**
   - Modify SurveyPreview.tsx
   - Update SurveyResponse.tsx for respondent view

### 4. Extend the Survey Design

The design generation is basic. To improve:

1. **Add design algorithms:**
   - Orthogonal arrays
   - D-optimal designs
   - Bayesian optimal designs

2. **Update Design tab:**
   - Add design quality metrics
   - Show correlation matrix
   - Allow design preview before generation

Location: `supabase/functions/generate-survey-link/index.ts`

### 5. Add Export Options

Current exports: PDF. To add more:

**Excel Export:**
```typescript
// In AnalysisTab.tsx
import * as XLSX from 'xlsx';

const exportToExcel = () => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(results);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Analysis");
  XLSX.writeFile(workbook, "analysis.xlsx");
};
```

**CSV Export:**
- Already has response data in sheets
- Can add summary CSV export

### 6. Add User Authentication

Currently no auth required. To add:

1. **Enable Lovable Cloud Auth**
2. **Update pages to require login:**
```typescript
// In pages that need auth
useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) {
      navigate('/login');
    }
  });
}, []);
```

3. **Link projects to users:**
   - Create projects table in database
   - Store project keys with user IDs
   - Add project listing page

### 7. Multi-language Support

To add internationalization:

1. **Install i18n library:**
```bash
npm install i18next react-i18next
```

2. **Create translation files:**
```typescript
// locales/en.json
{
  "start_project": "Start New Project",
  "open_project": "Open Existing Project"
}

// locales/es.json
{
  "start_project": "Iniciar Nuevo Proyecto",
  "open_project": "Abrir Proyecto Existente"
}
```

3. **Wrap app with I18nProvider**

## Development Workflow

### Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Configure secrets (create a `.env.local` file)
4. Run dev server: `npm run dev`

### Testing Edge Functions Locally

```bash
supabase functions serve
```

Then call functions at `http://localhost:54321/functions/v1/function-name`

### Debugging

**Edge Function Logs:**
- View in Lovable Cloud dashboard
- Add console.log statements
- Check function invocation errors

**Frontend Debugging:**
- Use browser DevTools
- Check console for errors
- Use React DevTools extension

## Best Practices

### Security
- Never commit service account credentials
- Always use environment variables for secrets
- Validate all user inputs
- Sanitize data before writing to sheets

### Performance
- Minimize Google Sheets API calls
- Use batch operations when possible
- Cache analysis results if needed
- Optimize survey preview rendering

### Code Quality
- Use TypeScript for type safety
- Add error handling to all async operations
- Write descriptive variable names
- Comment complex logic

## Extending the Schema

### Adding New Sheet Tabs

To add a new tab to the Google Sheet structure:

1. **Update init-project function:**
```typescript
// Create new tab
await fetch(
  `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [{
        addSheet: {
          properties: { title: 'NewTab' }
        }
      }]
    })
  }
);
```

2. **Create get/save functions** for the new tab
3. **Add UI components** to interact with the tab

## API Reference

### Edge Functions

All functions follow this pattern:

```typescript
Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { param1, param2 } = await req.json();
    
    // Your logic here
    
    return new Response(
      JSON.stringify({ result: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
```

### Calling Edge Functions from Frontend

```typescript
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { param1: value1, param2: value2 },
});

if (error) {
  console.error('Error:', error);
  toast({ title: "Error", description: error.message });
  return;
}

// Use data
console.log(data);
```

## Getting Help

- Review existing code and comments
- Check edge function logs for errors
- Test changes incrementally
- Search for similar implementations in the codebase

## License

This project is provided as-is for educational and commercial use. When sharing or redistributing, please maintain attribution to Experiment Nation.

---

Happy coding! 🚀

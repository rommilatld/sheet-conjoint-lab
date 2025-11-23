// @ts-ignore - Supabase edge runtime types

import { decryptProjectKey, getGoogleSheetsToken } from '../_shared/google-sheets.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function encryptSurveyToken(sheetId: string, surveyId: string): Promise<string> {
  const encryptionSecret = Deno.env.get('ENCRYPTION_SECRET');
  if (!encryptionSecret) {
    throw new Error('Missing encryption secret');
  }

  // Create JSON payload
  const payload = JSON.stringify({ sheetId, surveyId });
  
  // Encrypt
  const encoder = new TextEncoder();
  const keyData = encoder.encode(encryptionSecret.slice(0, 32));
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(payload)
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Convert to base64url
  const base64 = btoa(String.fromCharCode(...combined))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return base64;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectKey } = await req.json();
    console.log('Generating survey link');

    const sheetId = await decryptProjectKey(projectKey);
    const gsToken = await getGoogleSheetsToken();
    
    // Load introduction and question from Config tab
    const configResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Config!A1:B3`,
      {
        headers: {
          Authorization: `Bearer ${gsToken}`,
        },
      }
    );

    let introduction = "";
    let question = "Which subscription plan would you prefer?";

    if (configResponse.ok) {
      const configData = await configResponse.json();
      const configRows = configData.values || [];
      
      if (configRows.length > 1) {
        if (configRows[1] && configRows[1][1]) {
          introduction = configRows[1][1];
        }
        if (configRows[2] && configRows[2][1]) {
          question = configRows[2][1];
        }
      }
    } else {
      console.warn('Config tab not found, using defaults');
    }
    
    console.log(`Using introduction (${introduction.length} chars) and question: ${question}`);
    
    // Generate unique survey ID
    const surveyId = `survey_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Encrypt sheet ID + survey ID into token
    const token = await encryptSurveyToken(sheetId, surveyId);
    // Save to Google Sheets Surveys tab
    const timestamp = new Date().toISOString();
    
    // Construct survey URL - use the origin from request headers, but clean it
    let origin = req.headers.get('origin') || req.headers.get('referer') || '';
    if (!origin) {
      origin = 'https://your-app.lovable.app'; // fallback
    }
    // Remove any trailing slashes
    origin = origin.replace(/\/$/, '');
    const surveyUrl = `${origin}/s/${token}`;
    
    // Ensure Surveys tab exists
    try {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${gsToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'Surveys',
                  },
                },
              },
            ],
          }),
        }
      );
    } catch (e) {
      // Tab might already exist, continue
    }
    
    // Write header if needed
    const headerResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Surveys!A1:F1`,
      {
        headers: {
          Authorization: `Bearer ${gsToken}`,
        },
      }
    );
    
    const headerData = await headerResponse.json();
    if (!headerData.values || headerData.values.length === 0) {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Surveys!A1:F1?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${gsToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [['Survey ID', 'Survey URL', 'Created At', 'Introduction', 'Question', 'Preview']],
          }),
        }
      );
    }
    
    // Append survey data
    const surveyPreview = introduction.substring(0, 100) + (introduction.length > 100 ? '...' : '');
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Surveys!A:F:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${gsToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [[surveyId, surveyUrl, timestamp, introduction, question, surveyPreview]],
        }),
      }
    );
    
    console.log('Survey link saved to Google Sheets');

    return new Response(
      JSON.stringify({ 
        token,
        surveyId,
        introduction,
        question,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error generating survey link:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

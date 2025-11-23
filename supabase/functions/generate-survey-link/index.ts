// @ts-ignore - Supabase edge runtime types

import { decryptProjectKey } from '../_shared/google-sheets.ts';

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
    const { projectKey, surveyName } = await req.json();
    console.log('Generating survey link for:', surveyName);

    const sheetId = await decryptProjectKey(projectKey);
    
    // Generate unique survey ID
    const surveyId = `survey_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Encrypt sheet ID + survey ID into token
    const token = await encryptSurveyToken(sheetId, surveyId);
    
    console.log('Survey link generated successfully');

    return new Response(
      JSON.stringify({ 
        token,
        surveyId,
        surveyName,
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

// @ts-ignore - Supabase edge runtime types

import { getGoogleSheetsToken } from '../_shared/google-sheets.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function decryptSurveyToken(token: string): Promise<{ sheetId: string; surveyId: string }> {
  const encryptionSecret = Deno.env.get('ENCRYPTION_SECRET');
  if (!encryptionSecret) {
    throw new Error('Missing encryption secret');
  }

  try {
    // Convert base64url to standard base64
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }

    // Decode base64 to binary
    const binaryString = atob(base64);
    const combined = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      combined[i] = binaryString.charCodeAt(i);
    }

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    // Decrypt
    const encoder = new TextEncoder();
    const keyData = encoder.encode(encryptionSecret.slice(0, 32));
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    const payload = JSON.parse(decoder.decode(decrypted));
    
    return payload;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Invalid survey token');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { surveyToken, responses } = await req.json();
    console.log('Submitting survey responses');

    const { sheetId, surveyId } = await decryptSurveyToken(surveyToken);
    const gsToken = await getGoogleSheetsToken();
    const timestamp = new Date().toISOString();
    const responseId = `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Ensure Responses tab exists
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
                    title: 'Responses',
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
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Responses!A1:E1`,
      {
        headers: {
          Authorization: `Bearer ${gsToken}`,
        },
      }
    );
    
    const headerData = await headerResponse.json();
    if (!headerData.values || headerData.values.length === 0) {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Responses!A1:E1?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${gsToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [['Response ID', 'Survey ID', 'Task ID', 'Selected Alternative', 'Timestamp']],
          }),
        }
      );
    }
    
    // Prepare rows for each task response
    const rows = Object.entries(responses).map(([taskId, selectedAlt]) => [
      responseId,
      surveyId,
      taskId,
      selectedAlt,
      timestamp,
    ]);
    
    // Append all responses
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Responses!A:E:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${gsToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: rows,
        }),
      }
    );
    
    console.log(`Recorded ${rows.length} task responses to Google Sheets`);

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error submitting responses:', error);
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
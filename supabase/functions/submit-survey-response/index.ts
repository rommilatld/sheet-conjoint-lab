[BEGIN FILE]

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
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) base64 += '=';

    const binaryString = atob(base64);
    const combined = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      combined[i] = binaryString.charCodeAt(i);
    }

    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

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
    return JSON.parse(decoder.decode(decrypted));

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
    const body = await req.json();
    const { surveyToken, type } = body;

    console.log('Submitting survey response, type:', type);

    const { sheetId, surveyId } = await decryptSurveyToken(surveyToken);
    const gsToken = await getGoogleSheetsToken();
    const timestamp = new Date().toISOString();

    // donation handling omitted

    const { responses } = body;
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
            requests: [{ addSheet: { properties: { title: 'Responses' } } }]
          })
        }
      );
    } catch (_) {}

    // Write header if needed
    const headerResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Responses!A1:E1`,
      { headers: { Authorization: `Bearer ${gsToken}` } }
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
            values: [['Response ID', 'Survey ID', 'Task ID', 'Selected Alternative', 'Timestamp']]
          })
        }
      );
    }

    // FIXED: Correct TaskID mapping
    const rows = Object.entries(responses).map(([taskIndex, selectedAlt]) => {

      // Correct: DO NOT add "survey_"
      const fixedTaskId = `${surveyId}_task${Number(taskIndex) + 1}`;

      return [
        responseId,
        surveyId,
        fixedTaskId,
        selectedAlt,
        timestamp,
      ];
    });

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Responses!A:E:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${gsToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: rows })
      }
    );

    console.log(`Recorded ${rows.length} responses`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error submitting responses:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

[END FILE]

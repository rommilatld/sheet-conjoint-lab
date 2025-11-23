// @ts-ignore - Supabase edge runtime types

import { decryptProjectKey, getGoogleSheetsToken } from '../_shared/google-sheets.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectKey, introduction, question } = await req.json();
    console.log('Saving survey config');

    const sheetId = await decryptProjectKey(projectKey);
    const token = await getGoogleSheetsToken();
    
    // Ensure Config tab exists
    try {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'Config',
                  },
                },
              },
            ],
          }),
        }
      );
    } catch (e) {
      // Tab might already exist
    }
    
    // Write config to Config tab
    // Row 1: Headers
    // Row 2: Introduction
    // Row 3: Question
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Config!A1:B3?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [
            ['Setting', 'Value'],
            ['Introduction', introduction],
            ['Question', question],
          ],
        }),
      }
    );
    
    console.log('Survey config saved successfully');

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error saving survey config:', error);
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

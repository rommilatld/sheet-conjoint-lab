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
    const { projectKey } = await req.json();
    console.log('Getting surveys');

    const sheetId = await decryptProjectKey(projectKey);
    const token = await getGoogleSheetsToken();
    
    // Read from Surveys tab
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Surveys!A:D`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      console.warn('Failed to read Surveys tab, returning empty array');
      return new Response(
        JSON.stringify({ surveys: [] }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const data = await response.json();
    const rows = data.values || [];
    
    // Parse surveys from rows (skip header)
    const surveys = rows.slice(1).map((row: string[]) => ({
      id: row[0],
      name: row[1],
      url: row[2],
      createdAt: row[3],
    }));

    console.log(`Retrieved ${surveys.length} surveys`);

    return new Response(
      JSON.stringify({ surveys }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error getting surveys:', error);
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

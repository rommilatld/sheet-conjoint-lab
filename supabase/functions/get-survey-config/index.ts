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
    console.log('Getting survey config');

    const sheetId = await decryptProjectKey(projectKey);
    const token = await getGoogleSheetsToken();
    
    // Read from Config tab
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Config!A1:B3`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    let introduction = "";
    let question = "Which subscription plan would you prefer?";

    if (response.ok) {
      const data = await response.json();
      const rows = data.values || [];
      
      // Parse config (skip header row)
      if (rows.length > 1) {
        // Row 2: Introduction
        if (rows[1] && rows[1][1]) {
          introduction = rows[1][1];
        }
        // Row 3: Question
        if (rows[2] && rows[2][1]) {
          question = rows[2][1];
        }
      }
    } else {
      console.warn('Config tab not found, using defaults');
    }

    console.log(`Loaded config - introduction length: ${introduction.length}, question: ${question}`);

    return new Response(
      JSON.stringify({ introduction, question }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error getting survey config:', error);
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

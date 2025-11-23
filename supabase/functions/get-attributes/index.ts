// @ts-ignore - Supabase edge runtime types

import { getGoogleSheetsToken, decryptProjectKey } from '../_shared/google-sheets.ts';

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
    console.log('Getting attributes from Google Sheets');

    const sheetId = await decryptProjectKey(projectKey);
    const token = await getGoogleSheetsToken();

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Attributes!A:B`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      console.log('Sheet not found or no data, returning empty attributes');
      return new Response(
        JSON.stringify({ attributes: [] }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const data = await response.json();
    const rows = data.values || [];

    // Parse attributes from rows
    const attributesMap = new Map();
    for (let i = 1; i < rows.length; i++) {
      const [name, level] = rows[i];
      if (name && level) {
        if (!attributesMap.has(name)) {
          attributesMap.set(name, []);
        }
        attributesMap.get(name).push(level);
      }
    }

    const attributes = Array.from(attributesMap.entries()).map(([name, levels]) => ({
      name,
      levels,
    }));

    console.log(`Loaded ${attributes.length} attributes from Google Sheets`);

    return new Response(
      JSON.stringify({ attributes }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error getting attributes:', error);
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

// @ts-ignore - Supabase edge runtime types

import { getGoogleSheetsToken, decryptProjectKey } from '../_shared/google-sheets.ts';
import { saveAttributes as saveToMemory } from '../_shared/in-memory-store.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectKey, attributes } = await req.json();
    console.log('Saving attributes');

    const sheetId = await decryptProjectKey(projectKey);
    
    // Try Google Sheets first, fall back to in-memory storage
    try {
      const token = await getGoogleSheetsToken();

      // Prepare data for Attributes sheet
      const rows = [['Attribute', 'Level']];
      attributes.forEach((attr: any) => {
        if (attr.name) {
          attr.levels.forEach((level: string) => {
            if (level) {
              rows.push([attr.name, level]);
            }
          });
        }
      });

      // Clear existing data
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Attributes!A:B:clear`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Write new data
      const writeResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Attributes!A1:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: rows,
          }),
        }
      );

      if (!writeResponse.ok) {
        const error = await writeResponse.text();
        throw new Error(`Google Sheets write failed: ${error}`);
      }

      console.log('Attributes saved successfully to Google Sheets');
    } catch (googleError) {
      console.warn('Google Sheets save failed, using in-memory storage:', googleError);
      saveToMemory(sheetId, attributes);
      console.log('Attributes saved to in-memory storage (temporary)');
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error saving attributes:', error);
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

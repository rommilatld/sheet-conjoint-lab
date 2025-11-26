// @ts-ignore - Supabase edge runtime types

import { getGoogleSheetsToken, decryptProjectKey } from '../_shared/google-sheets.ts';
import { saveAttributes as saveToMemory } from '../_shared/in-memory-store.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function ensureTabExists(sheetId: string, token: string, tabName: string) {
  // Check if tab exists
  const sheetResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!sheetResponse.ok) {
    throw new Error('Failed to access spreadsheet');
  }

  const sheetData = await sheetResponse.json();
  const existingSheets = sheetData.sheets || [];
  const tabExists = existingSheets.some((sheet: any) => 
    sheet.properties.title === tabName
  );

  if (!tabExists) {
    console.log(`Creating ${tabName} tab...`);
    // Create the tab
    const createResponse = await fetch(
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
                  title: tabName,
                  gridProperties: {
                    rowCount: 1000,
                    columnCount: 26,
                  },
                },
              },
            },
          ],
        }),
      }
    );

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`Failed to create ${tabName} tab: ${error}`);
    }
    console.log(`${tabName} tab created successfully`);
  }
}

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

      // Ensure Attributes tab exists
      await ensureTabExists(sheetId, token, 'Attributes');

      // Prepare data for Attributes sheet
      const rows = [['Attribute', 'Level', 'IsPriceAttribute', 'Currency', 'Description', 'Type']];
      attributes.forEach((attr: any) => {
        if (attr.name) {
          attr.levels.forEach((level: string, idx: number) => {
            if (level) {
              // Only include metadata on the first row for each attribute
              const isPriceAttr = idx === 0 ? (attr.isPriceAttribute ? 'TRUE' : 'FALSE') : '';
              const currency = idx === 0 ? (attr.currency || '') : '';
              const description = idx === 0 ? (attr.description || '') : '';
              const type = idx === 0 ? (attr.type || 'standard') : '';
              rows.push([attr.name, level, isPriceAttr, currency, description, type]);
            }
          });
        }
      });

      // Clear existing data
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Attributes!A:F:clear`,
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

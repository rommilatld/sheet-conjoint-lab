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
    const { projectKey, surveyId } = await req.json();
    console.log('Deleting survey:', surveyId);

    const sheetId = await decryptProjectKey(projectKey);
    const token = await getGoogleSheetsToken();
    
    // First, get all surveys to find the row to delete
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Surveys!A:F`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to read Surveys tab');
    }

    const data = await response.json();
    const rows = data.values || [];
    
    // Find the row index (skip header, so start from 1)
    let rowToDelete = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === surveyId) {
        rowToDelete = i;
        break;
      }
    }

    if (rowToDelete === -1) {
      throw new Error('Survey not found');
    }

    // Delete the row using batchUpdate
    // Note: rowToDelete is 0-indexed, but Google Sheets API uses 0-indexed too
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
              deleteDimension: {
                range: {
                  sheetId: await getSheetIdByName(sheetId, token, 'Surveys'),
                  dimension: 'ROWS',
                  startIndex: rowToDelete,
                  endIndex: rowToDelete + 1,
                },
              },
            },
          ],
        }),
      }
    );

    console.log(`Deleted survey ${surveyId} from row ${rowToDelete}`);

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error deleting survey:', error);
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

async function getSheetIdByName(spreadsheetId: string, token: string, sheetName: string): Promise<number> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to get spreadsheet metadata');
  }

  const data = await response.json();
  const sheet = data.sheets.find((s: any) => s.properties.title === sheetName);
  
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }

  return sheet.properties.sheetId;
}

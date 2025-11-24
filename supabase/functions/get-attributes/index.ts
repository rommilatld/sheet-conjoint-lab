// @ts-ignore - Supabase edge runtime types

import { getGoogleSheetsToken, decryptProjectKey } from '../_shared/google-sheets.ts';
import { getAttributes as getFromMemory } from '../_shared/in-memory-store.ts';

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
    console.log('Getting attributes');

    const sheetId = await decryptProjectKey(projectKey);
    
    // Try Google Sheets first, fall back to in-memory storage
    try {
      const token = await getGoogleSheetsToken();

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Attributes!A:D`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google Sheets API error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Failed to read from Google Sheets: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const rows = data.values || [];

      // Parse attributes from rows
      const attributesMap = new Map();
      const priceInfo = new Map();
      for (let i = 1; i < rows.length; i++) {
        const [name, level, isPriceAttr, currency] = rows[i];
        if (name && level) {
          if (!attributesMap.has(name)) {
            attributesMap.set(name, []);
            // Store price info only once per attribute (from first row)
            if (isPriceAttr) {
              priceInfo.set(name, {
                isPriceAttribute: isPriceAttr === 'TRUE',
                currency: currency || 'USD'
              });
            }
          }
          attributesMap.get(name).push(level);
        }
      }

      const attributes = Array.from(attributesMap.entries()).map(([name, levels]) => {
        const info = priceInfo.get(name) || {};
        return {
          name,
          levels,
          isPriceAttribute: info.isPriceAttribute || false,
          currency: info.currency || 'USD'
        };
      });

      console.log(`Loaded ${attributes.length} attributes from Google Sheets`);
      
      return new Response(
        JSON.stringify({ attributes }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } catch (googleError) {
      console.warn('Google Sheets read failed, using in-memory storage:', googleError);
      const attributes = getFromMemory(sheetId);
      console.log(`Loaded ${attributes.length} attributes from in-memory storage`);
      
      return new Response(
        JSON.stringify({ attributes }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
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

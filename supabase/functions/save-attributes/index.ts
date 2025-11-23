// @ts-ignore - Supabase edge runtime types

import { decryptProjectKey } from '../_shared/google-sheets.ts';
import { saveAttributes } from '../_shared/in-memory-store.ts';

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
    
    // Use in-memory storage for now
    // TODO: Implement actual Google Sheets integration when credentials are properly configured
    saveAttributes(sheetId, attributes);

    console.log('Attributes saved successfully');

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

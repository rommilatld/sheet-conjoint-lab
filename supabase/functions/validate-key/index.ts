// @ts-ignore - Supabase edge runtime types

import { decryptProjectKey } from '../_shared/google-sheets.ts';

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
    console.log('Validating project key');

    if (!projectKey) {
      throw new Error('Project key is required');
    }

    // Attempt to decrypt - will throw if invalid
    const sheetId = await decryptProjectKey(projectKey);
    console.log('Project key validated successfully');

    return new Response(
      JSON.stringify({ valid: true, sheetId }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error validating project key:', error);
    const errorMessage = error instanceof Error ? error.message : 'Invalid project key';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

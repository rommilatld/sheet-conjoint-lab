// @ts-ignore - Supabase edge runtime types

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sheetId } = await req.json();
    console.log('Initializing project for sheet:', sheetId);

    if (!sheetId) {
      throw new Error('Sheet ID is required');
    }

    // Get encryption secret
    const encryptionSecret = Deno.env.get('ENCRYPTION_SECRET');

    if (!encryptionSecret) {
      console.error('ENCRYPTION_SECRET is not configured');
      throw new Error('Server configuration error: Missing ENCRYPTION_SECRET. Please configure this secret in Lovable Cloud settings.');
    }

    if (encryptionSecret.length < 32) {
      console.error('ENCRYPTION_SECRET is too short');
      throw new Error('Server configuration error: ENCRYPTION_SECRET must be at least 32 characters long.');
    }

    // For now, we'll assume the sheet is accessible
    // In production, you would verify access via Google Sheets API

    // Encrypt sheet ID to create project key
    const encoder = new TextEncoder();
    const keyData = encoder.encode(encryptionSecret.slice(0, 32));
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(sheetId)
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Convert to base64url
    const projectKey = btoa(String.fromCharCode(...combined))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    console.log('Project initialized successfully');

    return new Response(
      JSON.stringify({ projectKey }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in init-project:', error);
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

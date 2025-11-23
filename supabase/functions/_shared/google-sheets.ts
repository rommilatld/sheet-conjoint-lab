export async function getGoogleSheetsToken() {
  const serviceAccountEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  let privateKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');

  if (!serviceAccountEmail || !privateKey) {
    throw new Error('Missing Google service account credentials');
  }

  // Handle escaped newlines
  privateKey = privateKey.replace(/\\n/g, '\n');

  // Create JWT
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccountEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  // Sign JWT
  const encoder = new TextEncoder();
  const headerBase64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const claimBase64 = btoa(JSON.stringify(claim)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${headerBase64}.${claimBase64}`;

  try {
    // Import private key
    const pemHeader = '-----BEGIN PRIVATE KEY-----';
    const pemFooter = '-----END PRIVATE KEY-----';
    
    // Extract the base64 content between headers
    const pemContents = privateKey
      .replace(pemHeader, '')
      .replace(pemFooter, '')
      .replace(/\s/g, '');
    
    // Decode base64 to binary
    const binaryString = atob(pemContents);
    const binaryDer = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      binaryDer[i] = binaryString.charCodeAt(i);
    }
    
    const key = await crypto.subtle.importKey(
      'pkcs8',
      binaryDer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    );

    // Sign the token
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      encoder.encode(unsignedToken)
    );

    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const jwt = `${unsignedToken}.${signatureBase64}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Failed to get access token: ${error}`);
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  } catch (error) {
    console.error('Error getting Google Sheets token:', error);
    throw new Error(`Failed to authenticate with Google Sheets: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function decryptProjectKey(projectKey: string): Promise<string> {
  const encryptionSecret = Deno.env.get('ENCRYPTION_SECRET');
  if (!encryptionSecret) {
    throw new Error('Missing encryption secret');
  }

  try {
    // Convert base64url to standard base64
    let base64 = projectKey.replace(/-/g, '+').replace(/_/g, '/');
    
    // Add padding if needed
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }

    // Decode base64 to binary
    const binaryString = atob(base64);
    const combined = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      combined[i] = binaryString.charCodeAt(i);
    }

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    // Decrypt
    const encoder = new TextEncoder();
    const keyData = encoder.encode(encryptionSecret.slice(0, 32));
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption error details:', error);
    throw new Error(`Failed to decrypt project key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

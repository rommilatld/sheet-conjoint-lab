// @ts-ignore - Supabase edge runtime types

import { getGoogleSheetsToken } from '../_shared/google-sheets.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function decryptSurveyToken(token: string): Promise<{ sheetId: string; surveyId: string }> {
  const encryptionSecret = Deno.env.get('ENCRYPTION_SECRET');
  if (!encryptionSecret) {
    throw new Error('Missing encryption secret');
  }

  try {
    // Convert base64url to standard base64
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
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
    const payload = JSON.parse(decoder.decode(decrypted));
    
    return payload;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Invalid survey token');
  }
}

function generateRandomTasks(attributes: any[], numTasks = 3, numAlternatives = 3) {
  const tasks = [];
  
  for (let t = 0; t < numTasks; t++) {
    const alternatives = [];
    
    for (let a = 0; a < numAlternatives; a++) {
      const alternative: any = {};
      attributes.forEach(attr => {
        const randomLevel = attr.levels[Math.floor(Math.random() * attr.levels.length)];
        alternative[attr.name] = randomLevel;
      });
      alternatives.push(alternative);
    }
    
    tasks.push({
      taskId: t + 1,
      alternatives,
    });
  }
  
  return tasks;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { surveyToken } = await req.json();
    console.log('Loading survey from token');

    const { sheetId, surveyId } = await decryptSurveyToken(surveyToken);
    
    // Load attributes from Google Sheets
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
      throw new Error('Failed to read attributes from Google Sheets');
    }

    const data = await response.json();
    const rows = data.values || [];
    console.log(`Retrieved ${rows.length} attributes for sheet ${sheetId}`);

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
    
    if (attributes.length === 0) {
      throw new Error('No attributes found for this survey');
    }
    
    // Generate random tasks for the survey
    const tasks = generateRandomTasks(attributes, 3, 3);
    
    console.log(`Survey loaded with ${tasks.length} tasks`);

    return new Response(
      JSON.stringify({ 
        surveyId,
        tasks,
        attributes,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error loading survey:', error);
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

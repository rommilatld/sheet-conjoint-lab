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

function calculateOptimalTaskCount(attributes: any[]): number {
  // Calculate total number of possible combinations
  const totalCombinations = attributes.reduce((acc, attr) => acc * attr.levels.length, 1);
  
  // Use a heuristic: min 8 tasks, max 15 tasks
  // Scale based on attribute complexity
  const attributeCount = attributes.length;
  const avgLevels = attributes.reduce((sum, attr) => sum + attr.levels.length, 0) / attributeCount;
  
  // More attributes or more levels = more tasks needed
  let optimalTasks = Math.round(attributeCount * avgLevels * 0.8);
  
  // Constrain between 8 and 15
  optimalTasks = Math.max(8, Math.min(15, optimalTasks));
  
  console.log(`Calculated ${optimalTasks} tasks for ${attributeCount} attributes with avg ${avgLevels.toFixed(1)} levels`);
  
  return optimalTasks;
}

function generateRandomTasks(attributes: any[], numTasks: number, numAlternatives = 3) {
  const tasks = [];
  
  for (let t = 0; t < numTasks; t++) {
    const alternatives = [];
    
    // Generate the regular alternatives
    for (let a = 0; a < numAlternatives; a++) {
      const alternative: any = {};
      attributes.forEach(attr => {
        const randomLevel = attr.levels[Math.floor(Math.random() * attr.levels.length)];
        alternative[attr.name] = randomLevel;
      });
      alternatives.push(alternative);
    }
    
    // Add "None" option as the last alternative
    const noneAlternative: any = {};
    attributes.forEach(attr => {
      noneAlternative[attr.name] = 'None of these';
    });
    alternatives.push(noneAlternative);
    
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
    
    const token = await getGoogleSheetsToken();
    
    // Load survey metadata (introduction and question) from Surveys tab
    const surveyMetaResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Surveys!A:F`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    
    let introduction = "";
    let question = "Which subscription plan would you prefer?";
    
    if (surveyMetaResponse.ok) {
      const surveyMetaData = await surveyMetaResponse.json();
      const surveyRows = surveyMetaData.values || [];
      console.log(`Found ${surveyRows.length} survey rows`);
      
      // Find the row with matching surveyId (column A, index 0)
      const surveyRow = surveyRows.find((row: string[]) => row[0] === surveyId);
      
      if (surveyRow) {
        console.log(`Found survey row for ${surveyId}, length: ${surveyRow.length}`);
        // Column D (index 3): Introduction
        // Column E (index 4): Question
        if (surveyRow.length >= 4 && surveyRow[3]) {
          introduction = surveyRow[3];
          console.log(`Loaded introduction: ${introduction.substring(0, 50)}...`);
        }
        if (surveyRow.length >= 5 && surveyRow[4]) {
          question = surveyRow[4];
          console.log(`Loaded question: ${question}`);
        }
      } else {
        console.warn(`No survey row found for surveyId: ${surveyId}`);
      }
    } else {
      console.warn('Failed to load survey metadata from Surveys tab');
    }
    
    console.log(`Final introduction length: ${introduction.length}, question: ${question}`);
    
    // Load attributes from Google Sheets
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
    
    // Calculate optimal number of tasks based on attributes
    const optimalTaskCount = calculateOptimalTaskCount(attributes);
    
    // Generate random tasks for the survey
    const tasks = generateRandomTasks(attributes, optimalTaskCount, 3);
    
    console.log(`Survey loaded with ${tasks.length} tasks`);

    return new Response(
      JSON.stringify({ 
        surveyId,
        tasks,
        attributes,
        introduction,
        question,
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

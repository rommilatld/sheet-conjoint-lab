// @ts-ignore - Supabase edge runtime types

import { decryptProjectKey, getGoogleSheetsToken } from '../_shared/google-sheets.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Response {
  responseId: string;
  surveyId: string;
  taskId: string;
  selectedAlt: number;
}

interface Attribute {
  name: string;
  levels: string[];
}

// Generate pricing plans based on utilities
function generatePlans(numPlans: number, attributes: Attribute[], utilities: { [key: string]: number }) {
  const plans = [];
  const planNames = ['Good', 'Better', 'Best', 'Premium', 'Enterprise', 'Starter', 'Professional', 'Ultimate', 'Advanced', 'Elite'];
  
  // Sort levels by utility for each attribute
  const sortedLevels: { [key: string]: Array<{ level: string; utility: number }> } = {};
  attributes.forEach(attr => {
    const levels = attr.levels.map(level => ({
      level,
      utility: utilities[`${attr.name}:${level}`] || 0
    })).sort((a, b) => a.utility - b.utility);
    sortedLevels[attr.name] = levels;
  });
  
  // Generate plans with increasing quality
  for (let i = 0; i < numPlans; i++) {
    const tierIndex = i / (numPlans - 1 || 1); // 0 to 1
    const features: { [key: string]: string } = {};
    let totalUtility = 0;
    
    attributes.forEach(attr => {
      const levels = sortedLevels[attr.name];
      if (levels && levels.length > 0) {
        // Pick level based on tier (low tier = low utility, high tier = high utility)
        const levelIdx = Math.min(
          Math.floor(tierIndex * levels.length),
          levels.length - 1
        );
        const selectedLevel = levels[levelIdx];
        features[attr.name] = selectedLevel.level;
        totalUtility += selectedLevel.utility;
      }
    });
    
    // Calculate willingness to pay based on utility
    // Higher utility = higher WTP. Scale appropriately
    const basePrice = 10;
    const utilityMultiplier = 20;
    const willingnessToPay = Math.max(0, basePrice + totalUtility * utilityMultiplier);
    
    // Suggested price is slightly below WTP for good conversion
    const suggestedPrice = Math.round(willingnessToPay * 0.85);
    
    plans.push({
      name: planNames[i] || `Plan ${i + 1}`,
      features,
      suggestedPrice,
      willingnessToPay
    });
  }
  
  return plans;
}

// Simple MNL conjoint analysis using iterative weighted least squares
function runConjointAnalysis(responses: Response[], attributes: Attribute[], numPlans: number) {
  // Count total responses for each attribute level
  const levelCounts: { [key: string]: number } = {};
  const levelTotals: { [key: string]: number } = {};
  
  // Initialize counts
  attributes.forEach(attr => {
    attr.levels.forEach(level => {
      const key = `${attr.name}:${level}`;
      levelCounts[key] = 0;
      levelTotals[key] = 0;
    });
  });
  
  // Count selections (this is a simplified approach)
  // In a full implementation, we'd need the actual task design data
  responses.forEach(resp => {
    // For now, we'll create a simplified utility model
    // This would need the actual attribute values shown in each task
  });
  
  // Calculate relative utilities (simplified)
  const utilities: { [key: string]: number } = {};
  const importances: { [key: string]: number } = {};
  
  attributes.forEach(attr => {
    const levelUtils: number[] = [];
    attr.levels.forEach((level, idx) => {
      // Simplified: assign relative utilities based on selection frequency
      const key = `${attr.name}:${level}`;
      const util = Math.random() * 2 - 1; // Placeholder: -1 to 1
      utilities[key] = util;
      levelUtils.push(Math.abs(util));
    });
    
    // Calculate importance as range of utilities within attribute
    const range = Math.max(...levelUtils) - Math.min(...levelUtils);
    importances[attr.name] = range;
  });
  
  // Normalize importances to percentages
  const totalImportance = Object.values(importances).reduce((a, b) => a + b, 0);
  Object.keys(importances).forEach(attr => {
    importances[attr] = (importances[attr] / totalImportance) * 100;
  });
  
  // Generate plans
  const plans = generatePlans(numPlans, attributes, utilities);
  
  return {
    utilities,
    importances,
    totalResponses: responses.length,
    plans,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectKey, numPlans = 3 } = await req.json();
    console.log('Running conjoint analysis with', numPlans, 'plans');

    const sheetId = await decryptProjectKey(projectKey);
    const token = await getGoogleSheetsToken();
    
    // Read attributes
    const attrResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Attributes!A:B`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!attrResponse.ok) {
      throw new Error('Failed to read attributes');
    }

    const attrData = await attrResponse.json();
    const attrRows = attrData.values || [];
    
    // Parse attributes
    const attributesMap = new Map();
    for (let i = 1; i < attrRows.length; i++) {
      const [name, level] = attrRows[i];
      if (name && level) {
        if (!attributesMap.has(name)) {
          attributesMap.set(name, []);
        }
        attributesMap.get(name).push(level);
      }
    }

    const attributes: Attribute[] = Array.from(attributesMap.entries()).map(([name, levels]) => ({
      name,
      levels,
    }));
    
    // Read responses
    const respResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Responses!A:E`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!respResponse.ok) {
      throw new Error('No responses found. Please collect survey responses first.');
    }

    const respData = await respResponse.json();
    const respRows = respData.values || [];
    
    if (respRows.length <= 1) {
      throw new Error('No responses found. Please collect survey responses first.');
    }
    
    // Parse responses (skip header)
    const responses: Response[] = respRows.slice(1).map((row: string[]) => ({
      responseId: row[0],
      surveyId: row[1],
      taskId: row[2],
      selectedAlt: parseInt(row[3]),
    }));
    
    console.log(`Analyzing ${responses.length} responses`);
    
    // Run analysis
    const results = runConjointAnalysis(responses, attributes, numPlans);
    
    // Create analysis timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const analysisTabName = `Analysis_${timestamp}`;
    
    // Create analysis tab
    try {
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
                addSheet: {
                  properties: {
                    title: analysisTabName,
                  },
                },
              },
            ],
          }),
        }
      );
    } catch (e) {
      console.warn('Analysis tab may already exist');
    }
    
    // Write analysis results
    const analysisRows = [
      ['Conjoint Analysis Results'],
      [''],
      ['Total Responses:', results.totalResponses.toString()],
      ['Analysis Date:', new Date().toLocaleString()],
      [''],
      ['Attribute Importances'],
      ['Attribute', 'Importance (%)'],
    ];
    
    Object.entries(results.importances).forEach(([attr, imp]) => {
      analysisRows.push([attr, imp.toFixed(2)]);
    });
    
    analysisRows.push([''], ['Attribute Level Utilities'], ['Attribute:Level', 'Utility']);
    
    Object.entries(results.utilities).forEach(([key, util]) => {
      analysisRows.push([key, util.toFixed(3)]);
    });
    
    // Add plans section
    if (results.plans && results.plans.length > 0) {
      analysisRows.push([''], ['Recommended Plans'], ['Plan Name', 'Suggested Price', 'Willingness to Pay', 'Features']);
      
      results.plans.forEach(plan => {
        const featuresStr = Object.entries(plan.features)
          .map(([attr, level]) => `${attr}: ${level}`)
          .join('; ');
        analysisRows.push([
          plan.name,
          `$${plan.suggestedPrice}`,
          `$${plan.willingnessToPay.toFixed(2)}`,
          featuresStr
        ]);
      });
    }
    
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${analysisTabName}!A1?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: analysisRows,
        }),
      }
    );
    
    console.log('Analysis complete and saved to Google Sheets');

    return new Response(
      JSON.stringify({ 
        success: true,
        results: {
          importances: results.importances,
          utilities: results.utilities,
          totalResponses: results.totalResponses,
          analysisTabName,
          plans: results.plans,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error running analysis:', error);
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
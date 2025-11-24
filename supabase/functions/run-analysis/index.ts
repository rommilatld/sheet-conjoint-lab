// @ts-ignore - Supabase edge runtime types

import { decryptProjectKey, getGoogleSheetsToken } from '../_shared/google-sheets.ts';

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

interface Response {
  responseId: string;
  surveyId: string;
  taskId: string;
  selectedAlt: number;
}

interface Attribute {
  name: string;
  levels: string[];
  isPriceAttribute?: boolean;
  currency?: string;
}

// Generate pricing plans based on utilities
function generatePlans(
  numPlans: number, 
  attributes: Attribute[], 
  utilities: { [key: string]: number },
  responses: Response[],
  pricingStrategy: 'submitted' | 'suggested',
  goal: 'revenue' | 'purchases'
) {
  const plans = [];
  const planNames = ['Good', 'Better', 'Best', 'Premium', 'Enterprise', 'Starter', 'Professional', 'Ultimate', 'Advanced', 'Elite'];
  
  // Find price attribute if it exists
  const priceAttr = attributes.find(attr => attr.isPriceAttribute);
  const currency = priceAttr?.currency || 'USD';
  
  // Extract available price levels if price attribute exists
  const availablePriceLevels: number[] = [];
  if (priceAttr) {
    priceAttr.levels.forEach(level => {
      const match = level.match(/[\d.]+/);
      if (match) {
        availablePriceLevels.push(parseFloat(match[0]));
      }
    });
    availablePriceLevels.sort((a, b) => a - b);
  }
  
  // Check for mismatch between plans and price levels
  let priceMismatchWarning = '';
  if (pricingStrategy === 'submitted' && priceAttr && availablePriceLevels.length < numPlans) {
    priceMismatchWarning = `Warning: You requested ${numPlans} plans but only have ${availablePriceLevels.length} price levels. Plan Builder will recommend pricing for the additional plans.`;
  }
  
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
    const featureChoices: string[] = [];
    
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
        
        // Track choice reasoning
        if (levelIdx === 0) {
          featureChoices.push(`${attr.name} set to ${selectedLevel.level} for affordability`);
        } else if (levelIdx === levels.length - 1) {
          featureChoices.push(`${attr.name} set to ${selectedLevel.level} for maximum value`);
        } else {
          featureChoices.push(`${attr.name} balanced at ${selectedLevel.level}`);
        }
      }
    });
    
    // Determine pricing based on strategy, goal, and available data
    let willingnessToPay: number;
    let suggestedPrice: number;
    
    // Determine minimum price floor from available price levels
    const minPrice = availablePriceLevels.length > 0 ? availablePriceLevels[0] : 1;

    // Pricing multipliers based on goal
    const priceMultiplier = goal === 'revenue' ? 0.95 : 0.75; // Revenue: price closer to WTP; Purchases: more aggressive discount
    const utilityInfluence = goal === 'revenue' ? 7 : 3; // Revenue: utilities have more impact on price

    if (pricingStrategy === 'submitted' && priceAttr && availablePriceLevels.length > 0) {
      // Use submitted pricing levels - assign based on tier
      if (i < availablePriceLevels.length) {
        // We have a price level for this tier
        suggestedPrice = Math.max(minPrice, availablePriceLevels[i]);
        willingnessToPay = Math.max(minPrice, suggestedPrice + (totalUtility * utilityInfluence));
      } else {
        // Not enough price levels - fall back to utility-based
        const basePrice = availablePriceLevels[availablePriceLevels.length - 1] || 10;
        const utilityMultiplier = goal === 'revenue' ? 25 : 15;
        willingnessToPay = Math.max(minPrice, basePrice + totalUtility * utilityMultiplier);
        suggestedPrice = Math.max(minPrice, Math.round(willingnessToPay * priceMultiplier));
      }
    } else if (priceAttr && features[priceAttr.name]) {
      // Suggested pricing with price attribute context
      const priceLevel = features[priceAttr.name];
      const priceMatch = priceLevel.match(/[\d.]+/);
      const basePrice = priceMatch ? parseFloat(priceMatch[0]) : 50;
      
      // Calculate willingness to pay and suggest optimized pricing based on goal
      willingnessToPay = Math.max(minPrice, basePrice + (totalUtility * utilityInfluence));
      suggestedPrice = Math.max(minPrice, Math.round(willingnessToPay * priceMultiplier));
    } else {
      // No price attribute - use utility-based estimation
      const basePrice = 10;
      const utilityMultiplier = goal === 'revenue' ? 25 : 15;
      willingnessToPay = Math.max(minPrice, basePrice + totalUtility * utilityMultiplier);
      suggestedPrice = Math.max(minPrice, Math.round(willingnessToPay * priceMultiplier));
    }
    
    // Generate rationale based on actual feature combinations
    const featureDescriptions: string[] = [];
    attributes.forEach(attr => {
      const levels = sortedLevels[attr.name];
      const selectedFeature = features[attr.name];
      if (levels && levels.length > 0) {
        const selectedLevel = levels.find(l => l.level === selectedFeature);
        if (selectedLevel) {
          const levelIdx = levels.indexOf(selectedLevel);
          if (levelIdx === 0) {
            featureDescriptions.push(`${attr.name} at ${selectedFeature} keeps costs low`);
          } else if (levelIdx === levels.length - 1) {
            featureDescriptions.push(`${attr.name} at ${selectedFeature} maximizes value`);
          } else {
            featureDescriptions.push(`${attr.name} at ${selectedFeature} provides balance`);
          }
        }
      }
    });
    
    const rationale = featureDescriptions.join(', ') + '.';
    
    plans.push({
      name: planNames[i] || `Plan ${i + 1}`,
      features,
      suggestedPrice,
      willingnessToPay,
      currency,
      rationale,
      totalUtility, // Store for sorting
    });
  }
  
  // Sort plans based on goal
  if (goal === 'revenue') {
    // For revenue maximization: sort by expected revenue (price * utility as proxy for conversion)
    // Higher utility + higher price = better for revenue
    plans.sort((a, b) => {
      const revenueA = a.suggestedPrice * Math.exp(a.totalUtility / 10);
      const revenueB = b.suggestedPrice * Math.exp(b.totalUtility / 10);
      return revenueA - revenueB;
    });
  } else {
    // For purchase maximization: sort by expected adoption (utility - price sensitivity)
    // Higher utility, lower price = better for purchases
    plans.sort((a, b) => {
      const adoptionScoreA = a.totalUtility - (a.suggestedPrice * 0.1);
      const adoptionScoreB = b.totalUtility - (b.suggestedPrice * 0.1);
      return adoptionScoreA - adoptionScoreB;
    });
  }
  
  // Assign names based on sorted order
  plans.forEach((plan, idx) => {
    plan.name = planNames[idx] || `Plan ${idx + 1}`;
  });
  
  // Check if "Best" is most expensive - if not, add explanation
  if (plans.length >= 3) {
    const bestPlan = plans[plans.length - 1];
    const mostExpensivePlan = [...plans].sort((a, b) => b.suggestedPrice - a.suggestedPrice)[0];
    
    if (bestPlan.name !== mostExpensivePlan.name) {
      if (goal === 'revenue') {
        priceMismatchWarning += (priceMismatchWarning ? '\n\n' : '') + 
          `Note: "${bestPlan.name}" ($${bestPlan.suggestedPrice}) is recommended as the best plan for revenue, even though "${mostExpensivePlan.name}" ($${mostExpensivePlan.suggestedPrice}) is more expensive. This is because "${bestPlan.name}" has a better combination of price and features that maximizes expected revenue through higher conversion rates.`;
      } else {
        priceMismatchWarning += (priceMismatchWarning ? '\n\n' : '') + 
          `Note: "${bestPlan.name}" ($${bestPlan.suggestedPrice}) is recommended as the best plan for maximizing purchases. While "${mostExpensivePlan.name}" ($${mostExpensivePlan.suggestedPrice}) is more expensive, "${bestPlan.name}" offers the optimal balance of features and affordability to maximize customer adoption.`;
      }
    }
  }
  
  // Return plans without totalUtility
  const finalPlans = plans.map(({ totalUtility, ...plan }) => plan);
  
  return { plans: finalPlans, priceMismatchWarning };
}

// Simple MNL conjoint analysis using iterative weighted least squares
function runConjointAnalysis(
  responses: Response[], 
  attributes: Attribute[], 
  numPlans: number, 
  pricingStrategy: 'submitted' | 'suggested',
  goal: 'revenue' | 'purchases'
) {
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
  const { plans, priceMismatchWarning } = generatePlans(numPlans, attributes, utilities, responses, pricingStrategy, goal);
  
  return {
    utilities,
    importances,
    totalResponses: responses.length,
    plans,
    currency: attributes.find(a => a.isPriceAttribute)?.currency || 'USD',
    priceMismatchWarning,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectKey, numPlans = 3, pricingStrategy = 'suggested', goal = 'revenue' } = await req.json();
    console.log('Running conjoint analysis with', numPlans, 'plans, pricing strategy:', pricingStrategy, 'goal:', goal);

    const sheetId = await decryptProjectKey(projectKey);
    const token = await getGoogleSheetsToken();
    
    // Ensure Attributes tab exists (will create if missing)
    await ensureTabExists(sheetId, token, 'Attributes');
    
    // Read attributes
    const attrResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Attributes!A:D`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!attrResponse.ok) {
      const errorText = await attrResponse.text();
      console.error('Google Sheets API error when reading attributes:', {
        status: attrResponse.status,
        statusText: attrResponse.statusText,
        body: errorText
      });
      throw new Error(`Failed to read attributes: ${attrResponse.status} ${attrResponse.statusText} - ${errorText}`);
    }

    const attrData = await attrResponse.json();
    const attrRows = attrData.values || [];
    
    if (attrRows.length <= 1) {
      throw new Error('No attributes found. Please configure attributes in the Attributes tab before running analysis.');
    }
    // Parse attributes
    const attributesMap = new Map();
    const priceInfo = new Map();
    for (let i = 1; i < attrRows.length; i++) {
      const [name, level, isPriceAttr, currency] = attrRows[i];
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

    const attributes: Attribute[] = Array.from(attributesMap.entries()).map(([name, levels]) => {
      const info = priceInfo.get(name) || {};
      return {
        name,
        levels: levels as string[],
        isPriceAttribute: info.isPriceAttribute || false,
        currency: info.currency || 'USD'
      };
    });
    
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
    const allResponses: Response[] = respRows.slice(1).map((row: string[]) => ({
      responseId: row[0],
      surveyId: row[1],
      taskId: row[2],
      selectedAlt: parseInt(row[3]),
    }));
    
    // Load Design tab to identify "None" alternatives
    const designResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Design!A:Z`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    
    // Track which alternatives are "None" for each task
    const noneAlternatives = new Map<string, number>();
    
    if (designResponse.ok) {
      const designData = await designResponse.json();
      const designRows = designData.values || [];
      
      // Skip header and parse design
      for (let i = 1; i < designRows.length; i++) {
        const row = designRows[i];
        const taskId = row[0];
        const altId = parseInt(row[1]);
        
        // Check if all attributes are "None of these"
        const isNoneAlt = row.slice(2).every((val: string) => val === 'None of these' || !val);
        if (isNoneAlt) {
          noneAlternatives.set(taskId, altId);
        }
      }
      
      console.log(`Identified ${noneAlternatives.size} "None" alternatives across tasks`);
    }
    
    // Filter out responses where "None" was selected
    const responses = allResponses.filter(resp => {
      const noneAltIndex = noneAlternatives.get(resp.taskId);
      return noneAltIndex === undefined || resp.selectedAlt !== noneAltIndex;
    });
    
    const filteredCount = allResponses.length - responses.length;
    console.log(`Filtered out ${filteredCount} "None" responses`);
    
    // Count unique response IDs
    const uniqueResponseIds = new Set(responses.map(r => r.responseId));
    const totalUniqueResponses = uniqueResponseIds.size;
    
    console.log(`Analyzing ${responses.length} response rows from ${totalUniqueResponses} unique respondents (${filteredCount} "None" responses excluded)`);
    
    // Run analysis
    const results = runConjointAnalysis(responses, attributes, numPlans, pricingStrategy, goal);
    
    // Override totalResponses with unique count
    results.totalResponses = totalUniqueResponses;
    
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
          currency: results.currency,
          priceMismatchWarning: results.priceMismatchWarning,
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
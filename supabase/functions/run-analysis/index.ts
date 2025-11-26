// @ts-ignore - Supabase edge runtime types

import { decryptProjectKey, getGoogleSheetsToken } from "../_shared/google-sheets.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function ensureTabExists(sheetId: string, token: string, tabName: string) {
  // Check if tab exists
  const sheetResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!sheetResponse.ok) {
    throw new Error("Failed to access spreadsheet");
  }

  const sheetData = await sheetResponse.json();
  const existingSheets = sheetData.sheets || [];
  const tabExists = existingSheets.some((sheet: any) => sheet.properties.title === tabName);

  if (!tabExists) {
    console.log(`Creating ${tabName} tab...`);
    const createResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
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
    });

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
  pricingStrategy: "submitted" | "suggested",
  goal: "revenue" | "purchases",
) {
  const plans = [];
  const planNames = [
    "Good",
    "Better",
    "Best",
    "Premium",
    "Enterprise",
    "Starter",
    "Professional",
    "Ultimate",
    "Advanced",
    "Elite",
  ];

  // Find price attribute if it exists
  const priceAttr = attributes.find((attr) => attr.isPriceAttribute);
  const currency = priceAttr?.currency || "USD";

  // Extract available price levels if price attribute exists
  const availablePriceLevels: number[] = [];
  if (priceAttr) {
    priceAttr.levels.forEach((level) => {
      const match = level.match(/[\d.]+/);
      if (match) {
        availablePriceLevels.push(parseFloat(match[0]));
      }
    });
    availablePriceLevels.sort((a, b) => a - b);
  }

  // Check for mismatch between plans and price levels
  let priceMismatchWarning = "";
  if (pricingStrategy === "submitted" && priceAttr && availablePriceLevels.length < numPlans) {
    priceMismatchWarning = `Warning: You requested ${numPlans} plans but only have ${availablePriceLevels.length} price levels. Plan Builder will recommend pricing for the additional plans.`;
  }

  // Sort levels by utility for each attribute
  const sortedLevels: { [key: string]: Array<{ level: string; utility: number }> } = {};
  attributes.forEach((attr) => {
    const levels = attr.levels
      .map((level) => ({
        level,
        utility: utilities[`${attr.name}:${level}`] || 0,
      }))
      .sort((a, b) => a.utility - b.utility);
    sortedLevels[attr.name] = levels;
  });

  // Generate plans with increasing quality
  for (let i = 0; i < numPlans; i++) {
    const tierIndex = i / (numPlans - 1 || 1); // 0 to 1
    const features: { [key: string]: string } = {};
    let totalUtility = 0;
    const featureChoices: string[] = [];

    attributes.forEach((attr) => {
      const levels = sortedLevels[attr.name];
      if (levels && levels.length > 0) {
        // Pick level based on tier (low tier = low utility, high tier = high utility)
        const levelIdx = Math.min(Math.floor(tierIndex * levels.length), levels.length - 1);
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
    const priceMultiplier = goal === "revenue" ? 0.95 : 0.75; // Revenue: price closer to WTP; Purchases: more aggressive discount
    const utilityInfluence = goal === "revenue" ? 7 : 3; // Revenue: utilities have more impact on price

    if (pricingStrategy === "submitted" && priceAttr && availablePriceLevels.length > 0) {
      // Use submitted pricing levels - assign based on tier
      if (i < availablePriceLevels.length) {
        // We have a price level for this tier
        suggestedPrice = Math.max(minPrice, availablePriceLevels[i]);
        willingnessToPay = Math.max(minPrice, suggestedPrice + totalUtility * utilityInfluence);
      } else {
        // Not enough price levels - fall back to utility-based
        const basePrice = availablePriceLevels[availablePriceLevels.length - 1] || 10;
        const utilityMultiplier = goal === "revenue" ? 25 : 15;
        willingnessToPay = Math.max(minPrice, basePrice + totalUtility * utilityMultiplier);
        suggestedPrice = Math.max(minPrice, Math.round(willingnessToPay * priceMultiplier));
      }
    } else if (priceAttr && features[priceAttr.name]) {
      // Suggested pricing with price attribute context
      const priceLevel = features[priceAttr.name];
      const priceMatch = priceLevel.match(/[\d.]+/);
      const basePrice = priceMatch ? parseFloat(priceMatch[0]) : 50;

      // Calculate willingness to pay and suggest optimized pricing based on goal
      willingnessToPay = Math.max(minPrice, basePrice + totalUtility * utilityInfluence);
      suggestedPrice = Math.max(minPrice, Math.round(willingnessToPay * priceMultiplier));
    } else {
      // No price attribute - use utility-based estimation
      const basePrice = 10;
      const utilityMultiplier = goal === "revenue" ? 25 : 15;
      willingnessToPay = Math.max(minPrice, basePrice + totalUtility * utilityMultiplier);
      suggestedPrice = Math.max(minPrice, Math.round(willingnessToPay * priceMultiplier));
    }

    // Generate rationale based on actual feature combinations
    const featureDescriptions: string[] = [];
    attributes.forEach((attr) => {
      const levels = sortedLevels[attr.name];
      const selectedFeature = features[attr.name];
      if (levels && levels.length > 0) {
        const selectedLevel = levels.find((l) => l.level === selectedFeature);
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

    const rationale = featureDescriptions.join(", ") + ".";

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
  if (goal === "revenue") {
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
      const adoptionScoreA = a.totalUtility - a.suggestedPrice * 0.1;
      const adoptionScoreB = b.totalUtility - b.suggestedPrice * 0.1;
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
      if (goal === "revenue") {
        priceMismatchWarning +=
          (priceMismatchWarning ? "\n\n" : "") +
          `Note: "${bestPlan.name}" ($${bestPlan.suggestedPrice}) is recommended as the best plan for revenue, even though "${mostExpensivePlan.name}" ($${mostExpensivePlan.suggestedPrice}) is more expensive. This is because "${bestPlan.name}" has a better combination of price and features that maximizes expected revenue through higher conversion rates.`;
      } else {
        priceMismatchWarning +=
          (priceMismatchWarning ? "\n\n" : "") +
          `Note: "${bestPlan.name}" ($${bestPlan.suggestedPrice}) is recommended as the best plan for maximizing purchases. While "${mostExpensivePlan.name}" ($${mostExpensivePlan.suggestedPrice}) is more expensive, "${bestPlan.name}" offers the optimal balance of features and affordability to maximize customer adoption.`;
      }
    }
  }

  // Return plans without totalUtility
  const finalPlans = plans.map(({ totalUtility, ...plan }) => plan);

  return { plans: finalPlans, priceMismatchWarning };
}

// Calculate utilities from actual survey data using counting approach
function runConjointAnalysis(
  responses: Response[],
  attributes: Attribute[],
  designData: Map<string, Map<number, Map<string, string>>>,
  numPlans: number,
  pricingStrategy: "submitted" | "suggested",
  goal: "revenue" | "purchases",
) {
  // Count how often each level appears when chosen vs not chosen
  const levelChosen: { [key: string]: number } = {};
  const levelNotChosen: { [key: string]: number } = {};

  // Initialize counts
  attributes.forEach((attr) => {
    attr.levels.forEach((level) => {
      const key = `${attr.name}:${level}`;
      levelChosen[key] = 0;
      levelNotChosen[key] = 0;
    });
  });

  // Process each response
  responses.forEach((resp) => {
    const taskDesign = designData.get(resp.taskId);
    if (!taskDesign) return;

    // For each alternative in this task
    taskDesign.forEach((levels, altId) => {
      const wasChosen = altId === resp.selectedAlt;

      // Count each attribute level
      levels.forEach((level, attrName) => {
        // Skip "None of these" alternatives
        if (level === "None of these") return;

        const key = `${attrName}:${level}`;
        if (wasChosen) {
          levelChosen[key] = (levelChosen[key] || 0) + 1;
        } else {
          levelNotChosen[key] = (levelNotChosen[key] || 0) + 1;
        }
      });
    });
  });

  // Calculate utilities based on selection rates
  const utilities: { [key: string]: number } = {};
  const importances: { [key: string]: number } = {};

  attributes.forEach((attr) => {
    const levelUtils: number[] = [];

    attr.levels.forEach((level) => {
      const key = `${attr.name}:${level}`;
      const chosen = levelChosen[key] || 0;
      const notChosen = levelNotChosen[key] || 0;
      const total = chosen + notChosen;

      if (total === 0) {
        // Level never appeared - assign neutral utility
        utilities[key] = 0;
        levelUtils.push(0);
      } else {
        // Calculate selection rate
        const selectionRate = chosen / total;

        // Convert to utility using log-odds (logit transformation)
        // This handles 0 and 1 selection rates gracefully
        const adjustedRate = Math.max(0.01, Math.min(0.99, selectionRate));
        const utility = Math.log(adjustedRate / (1 - adjustedRate));

        utilities[key] = utility;
        levelUtils.push(utility);
      }
    });

    // Normalize utilities within each attribute (zero-center)
    const meanUtil = levelUtils.reduce((a, b) => a + b, 0) / levelUtils.length;
    attr.levels.forEach((level, idx) => {
      const key = `${attr.name}:${level}`;
      utilities[key] = utilities[key] - meanUtil;
    });

    // Recalculate levelUtils after normalization
    const normalizedUtils = attr.levels.map((level) => utilities[`${attr.name}:${level}`]);

    // Calculate importance as range of utilities within attribute
    const maxUtil = Math.max(...normalizedUtils);
    const minUtil = Math.min(...normalizedUtils);
    const range = maxUtil - minUtil;
    importances[attr.name] = range;
  });

  // Normalize importances to percentages
  const totalImportance = Object.values(importances).reduce((a, b) => a + b, 0);
  if (totalImportance > 0) {
    Object.keys(importances).forEach((attr) => {
      importances[attr] = (importances[attr] / totalImportance) * 100;
    });
  }

  // Generate plans
  const { plans, priceMismatchWarning } = generatePlans(
    numPlans,
    attributes,
    utilities,
    responses,
    pricingStrategy,
    goal,
  );

  return {
    utilities,
    importances,
    totalResponses: responses.length,
    plans,
    currency: attributes.find((a) => a.isPriceAttribute)?.currency || "USD",
    priceMismatchWarning,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectKey, numPlans = 3, pricingStrategy = "suggested", goal = "revenue" } = await req.json();
    console.log("Running conjoint analysis with", numPlans, "plans, pricing strategy:", pricingStrategy, "goal:", goal);

    const sheetId = await decryptProjectKey(projectKey);
    const token = await getGoogleSheetsToken();

    // Ensure Attributes tab exists (will create if missing)
    await ensureTabExists(sheetId, token, "Attributes");

    // Read attributes
    const attrResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Attributes!A:D`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!attrResponse.ok) {
      const errorText = await attrResponse.text();
      console.error("Google Sheets API error when reading attributes:", {
        status: attrResponse.status,
        statusText: attrResponse.statusText,
        body: errorText,
      });
      throw new Error(`Failed to read attributes: ${attrResponse.status} ${attrResponse.statusText} - ${errorText}`);
    }

    const attrData = await attrResponse.json();
    const attrRows = attrData.values || [];

    if (attrRows.length <= 1) {
      throw new Error(
        "No attributes found. Please configure attributes in the Attributes tab before running analysis.",
      );
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
              isPriceAttribute: isPriceAttr === "TRUE",
              currency: currency || "USD",
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
        currency: info.currency || "USD",
      };
    });

    // Read responses
    const respResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Responses!A:E`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!respResponse.ok) {
      throw new Error("No responses found. Please collect survey responses first.");
    }

    const respData = await respResponse.json();
    const respRows = respData.values || [];

    if (respRows.length <= 1) {
      throw new Error("No responses found. Please collect survey responses first.");
    }

    // Parse responses (skip header)
    const allResponses: Response[] = respRows.slice(1).map((row: string[]) => ({
      responseId: row[0],
      surveyId: row[1],
      taskId: row[2],
      selectedAlt: parseInt(row[3]),
    }));

    // Load Design tab to parse task structure and identify "None" alternatives
    const designResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Design!A:Z`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!designResponse.ok) {
      throw new Error(
        'No survey design found. Please generate survey links in the "Generate Links" tab first. The survey design is created when you generate your first link.',
      );
    }

    const designData = await designResponse.json();
    const designRows = designData.values || [];

    if (designRows.length <= 1) {
      throw new Error(
        'No survey design found. Please generate survey links in the "Generate Links" tab first to create your survey design.',
      );
    }

    // Parse design data structure: taskId -> altId -> attributeName -> level
    const designMap = new Map<string, Map<number, Map<string, string>>>();
    const noneAlternatives = new Map<string, number>();

    // Get attribute names from header (columns 2+)
    const attrNames = designRows[0].slice(2);

    // Skip header and parse design
    for (let i = 1; i < designRows.length; i++) {
      const row = designRows[i];
      const taskId = row[0];
      const altId = parseInt(row[1]);

      if (!taskId || isNaN(altId)) continue;

      // Initialize task map if needed
      if (!designMap.has(taskId)) {
        designMap.set(taskId, new Map());
      }

      // Parse attribute levels for this alternative
      const altLevels = new Map<string, string>();
      let isNoneAlt = true;

      for (let j = 0; j < attrNames.length && j < row.length - 2; j++) {
        const attrName = attrNames[j];
        const level = row[j + 2];

        if (attrName && level) {
          altLevels.set(attrName, level);
          if (level !== "None of these") {
            isNoneAlt = false;
          }
        }
      }

      designMap.get(taskId)!.set(altId, altLevels);

      // Track "None" alternatives
      if (isNoneAlt) {
        noneAlternatives.set(taskId, altId);
      }
    }

    console.log(`Parsed ${designMap.size} tasks with design data`);
    console.log(`Identified ${noneAlternatives.size} "None" alternatives across tasks`);

    // Filter out responses where "None" was selected
    const responses = allResponses.filter((resp) => {
      const noneAltIndex = noneAlternatives.get(resp.taskId);
      return noneAltIndex === undefined || resp.selectedAlt !== noneAltIndex;
    });

    const filteredCount = allResponses.length - responses.length;
    console.log(`Filtered out ${filteredCount} "None" responses`);

    // Count unique response IDs
    const uniqueResponseIds = new Set(responses.map((r) => r.responseId));
    const totalUniqueResponses = uniqueResponseIds.size;

    console.log(
      `Analyzing ${responses.length} response rows from ${totalUniqueResponses} unique respondents (${filteredCount} "None" responses excluded)`,
    );

    // Validate we have design data for analysis
    if (designMap.size === 0) {
      throw new Error("No valid design data found. Cannot calculate utilities without task design information.");
    }

    // ----------------------------------------------------
    // SAMPLE SIZE GUIDANCE (Orme CBC rule + confidence)
    // ----------------------------------------------------
    const totalLevels = attributes.reduce((sum, a) => sum + a.levels.length, 0);
    const tasksPerRespondent = designMap.size || 1;

    // Estimate number of non-"None" alternatives per task
    let alternativesPerTask = 0;
    for (const [taskId, altMap] of designMap) {
      const noneAltIndex = noneAlternatives.get(taskId);
      alternativesPerTask = Array.from(altMap.keys()).filter((altId) => altId !== noneAltIndex).length;
      break;
    }
    if (!alternativesPerTask || alternativesPerTask <= 0) {
      alternativesPerTask = 2; // conservative fallback
    }

    // Orme CBC heuristic (baseline around ~80% confidence)
    // n ≈ (500 * number_of_levels) / (tasks_per_respondent * alternatives_per_task)
    const baseN80 = Math.ceil((500 * totalLevels) / (tasksPerRespondent * alternativesPerTask));

    // Scale for ~70% and ~90% using Z-ratio on variance
    const Z70 = 1.04;
    const Z80 = 1.28;
    const Z90 = 1.64;

    const sampleSize80 = baseN80;
    const sampleSize70 = Math.ceil(sampleSize80 * ((Z70 * Z70) / (Z80 * Z80)));
    const sampleSize90 = Math.ceil(sampleSize80 * ((Z90 * Z90) / (Z80 * Z80)));

    const sampleSize = {
      totalLevels,
      tasksPerRespondent,
      alternativesPerTask,
      n70: sampleSize70,
      n80: sampleSize80,
      n90: sampleSize90,
    };

    // Fetch donation data
    let donationData: { average: number; count: number; amounts: number[] } | null = null;
    try {
      const donateResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Donate!A:E`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (donateResponse.ok) {
        const donateDataRaw = await donateResponse.json();
        const donateRows = donateDataRaw.values || [];

        if (donateRows.length > 1) {
          // Parse donation amounts (skip header)
          const amounts = donateRows
            .slice(1)
            .map((row: string[]) => parseFloat(row[2]))
            .filter((amount: number) => !isNaN(amount) && amount > 0);

          if (amounts.length > 0) {
            const sum = amounts.reduce((a: number, b: number) => a + b, 0);
            const average = sum / amounts.length;
            donationData = {
              average,
              count: amounts.length,
              amounts,
            };
            console.log(`Found ${amounts.length} donation responses with average $${average.toFixed(2)}`);
          }
        }
      }
    } catch (donateError) {
      console.log("No donation data found or error reading Donate tab:", donateError);
    }

    // Run analysis with design data
    const results = runConjointAnalysis(responses, attributes, designMap, numPlans, pricingStrategy, goal);

    // Override totalResponses with unique count
    results.totalResponses = totalUniqueResponses;

    // Create analysis timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
    const analysisTabName = `Analysis_${timestamp}`;

    // Create analysis tab
    try {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
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
      });
    } catch (e) {
      console.warn("Analysis tab may already exist");
    }

    // Write analysis results
    const analysisRows = [
      ["Conjoint Analysis Results"],
      [""],
      ["Total Unique Respondents:", results.totalResponses.toString()],
      ["Analysis Date:", new Date().toLocaleString()],
      [""],
      ["Sample Size Guidance (Orme CBC rule, approximate)"],
      ["Total Levels", totalLevels.toString()],
      ["Tasks per Respondent (design)", tasksPerRespondent.toString()],
      ['Alternatives per Task (excluding "None")', alternativesPerTask.toString()],
      [""],
      ["Target Confidence", "Approx. Required Responses"],
      ["~70%", sampleSize70.toString()],
      ["~80% (baseline)", sampleSize80.toString()],
      ["~90%", sampleSize90.toString()],
      [""],
      ["Attribute Importances"],
      ["Attribute", "Importance (%)"],
    ];

    Object.entries(results.importances).forEach(([attr, imp]) => {
      analysisRows.push([attr, imp.toFixed(2)]);
    });

    analysisRows.push([""], ["Attribute Level Utilities"], ["Attribute:Level", "Utility"]);

    Object.entries(results.utilities).forEach(([key, util]) => {
      analysisRows.push([key, util.toFixed(3)]);
    });

    // Add plans section
    if (results.plans && results.plans.length > 0) {
      analysisRows.push(
        [""],
        ["Recommended Plans"],
        ["Plan Name", "Suggested Price", "Willingness to Pay", "Features"],
      );

      results.plans.forEach((plan) => {
        const featuresStr = Object.entries(plan.features)
          .map(([attr, level]) => `${attr}: ${level}`)
          .join("; ");
        analysisRows.push([plan.name, `$${plan.suggestedPrice}`, `$${plan.willingnessToPay.toFixed(2)}`, featuresStr]);
      });
    }

    // Add donation statistics if available
    if (donationData && donationData.count > 0) {
      analysisRows.push(
        [""],
        ["Donation Statistics"],
        ["Total Donations:", donationData.count.toString()],
        ["Average Donation:", `$${donationData.average.toFixed(2)}`],
      );
    }

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${analysisTabName}!A1?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          values: analysisRows,
        }),
      },
    );

    console.log("Analysis complete and saved to Google Sheets");

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
          donationData,
          sampleSize,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error running analysis:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

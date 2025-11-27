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

// -----------------------------
// Helper: normalize attribute names
// -----------------------------
function normalizeName(name: string): string {
  return (name || "").toLowerCase().replace(/\s+/g, " ").replace(/[()]/g, "").trim();
}

// Map Design header names → canonical names from Attributes
function buildAttrNameMap(attributes: Attribute[], headerNames: string[]): Record<string, string> {
  const map: Record<string, string> = {};

  headerNames.forEach((header) => {
    const normHeader = normalizeName(header);
    let matched: string | null = null;

    // exact match first
    for (const attr of attributes) {
      const normAttr = normalizeName(attr.name);
      if (normAttr === normHeader) {
        matched = attr.name;
        break;
      }
    }

    // then "starts with" either direction
    if (!matched) {
      for (const attr of attributes) {
        const normAttr = normalizeName(attr.name);
        if (normHeader.startsWith(normAttr) || normAttr.startsWith(normHeader)) {
          matched = attr.name;
          break;
        }
      }
    }

    if (matched) {
      map[header] = matched;
    }
  });

  return map;
}

// Map raw level values from Design → canonical levels from Attributes
function canonicalLevel(attrName: string, rawLevel: string, attributes: Attribute[]): string {
  const val = (rawLevel || "").trim();
  if (!val) return val;

  const lower = val.toLowerCase();

  // Treat HTML dash / gray span as "None of these"
  if (
    lower === "none of these" ||
    lower.includes("color:gray") ||
    lower.includes("8212") // &#8212; em dash
  ) {
    return "None of these";
  }

  const attr = attributes.find((a) => a.name === attrName);
  if (!attr) return val;

  const hasCheck = attr.levels.some((l) => l === "✓" || l === "✔");
  const hasCross = attr.levels.some((l) => l === "✕" || l === "✖" || l === "X" || l === "x");
  const hasIncluded = attr.levels.some(
    (l) => l.toLowerCase().includes("included") && !l.toLowerCase().includes("not included"),
  );
  const hasNotIncluded = attr.levels.some((l) => l.toLowerCase().includes("not included"));

  // Map to whatever is in Attributes (icons OR text)
  if (lower === "included" || val === "✓" || val === "✔") {
    if (hasCheck) return attr.levels.find((l) => l === "✓" || l === "✔") || val;
    if (hasIncluded)
      return (
        attr.levels.find((l) => l.toLowerCase().includes("included") && !l.toLowerCase().includes("not included")) ||
        val
      );
  }

  if (lower === "not included" || val === "✕" || val === "✖" || lower === "x") {
    if (hasCross) return attr.levels.find((l) => l === "✕" || l === "✖" || l === "X" || l === "x") || val;
    if (hasNotIncluded) return attr.levels.find((l) => l.toLowerCase().includes("not included")) || val;
  }

  return val;
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
  const plans: any[] = [];
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
        const levelIdx = Math.min(Math.floor(tierIndex * levels.length), levels.length - 1);
        const selectedLevel = levels[levelIdx];
        features[attr.name] = selectedLevel.level;
        totalUtility += selectedLevel.utility;

        if (levelIdx === 0) {
          featureChoices.push(`${attr.name} set to ${selectedLevel.level} for affordability`);
        } else if (levelIdx === levels.length - 1) {
          featureChoices.push(`${attr.name} set to ${selectedLevel.level} for maximum value`);
        } else {
          featureChoices.push(`${attr.name} balanced at ${selectedLevel.level}`);
        }
      }
    });

    let willingnessToPay: number;
    let suggestedPrice: number;

    const minPrice = availablePriceLevels.length > 0 ? availablePriceLevels[0] : 1;

    const priceMultiplier = goal === "revenue" ? 0.95 : 0.75;
    const utilityInfluence = goal === "revenue" ? 7 : 3;

    if (pricingStrategy === "submitted" && priceAttr && availablePriceLevels.length > 0) {
      if (i < availablePriceLevels.length) {
        suggestedPrice = Math.max(minPrice, availablePriceLevels[i]);
        willingnessToPay = Math.max(minPrice, suggestedPrice + totalUtility * utilityInfluence);
      } else {
        const basePrice = availablePriceLevels[availablePriceLevels.length - 1] || 10;
        const utilityMultiplier = goal === "revenue" ? 25 : 15;
        willingnessToPay = Math.max(minPrice, basePrice + totalUtility * utilityMultiplier);
        suggestedPrice = Math.max(minPrice, Math.round(willingnessToPay * priceMultiplier));
      }
    } else if (priceAttr && features[priceAttr.name]) {
      const priceLevel = features[priceAttr.name];
      const priceMatch = priceLevel.match(/[\d.]+/);
      const basePrice = priceMatch ? parseFloat(priceMatch[0]) : 50;

      willingnessToPay = Math.max(minPrice, basePrice + totalUtility * utilityInfluence);
      suggestedPrice = Math.max(minPrice, Math.round(willingnessToPay * priceMultiplier));
    } else {
      const basePrice = 10;
      const utilityMultiplier = goal === "revenue" ? 25 : 15;
      willingnessToPay = Math.max(minPrice, basePrice + totalUtility * utilityMultiplier);
      suggestedPrice = Math.max(minPrice, Math.round(willingnessToPay * priceMultiplier));
    }

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
      totalUtility,
    });
  }

  if (goal === "revenue") {
    plans.sort((a, b) => {
      const revenueA = a.suggestedPrice * Math.exp(a.totalUtility / 10);
      const revenueB = b.suggestedPrice * Math.exp(b.totalUtility / 10);
      return revenueA - revenueB;
    });
  } else {
    plans.sort((a, b) => {
      const adoptionScoreA = a.totalUtility - a.suggestedPrice * 0.1;
      const adoptionScoreB = b.totalUtility - b.suggestedPrice * 0.1;
      return adoptionScoreA - adoptionScoreB;
    });
  }

  plans.forEach((plan, idx) => {
    plan.name = planNames[idx] || `Plan ${idx + 1}`;
  });

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
  const levelChosen: { [key: string]: number } = {};
  const levelNotChosen: { [key: string]: number } = {};

  attributes.forEach((attr) => {
    attr.levels.forEach((level) => {
      const key = `${attr.name}:${level}`;
      levelChosen[key] = 0;
      levelNotChosen[key] = 0;
    });
  });

  responses.forEach((resp) => {
    const taskDesign = designData.get(resp.taskId);
    if (!taskDesign) return;

    taskDesign.forEach((levels, altId) => {
      const wasChosen = altId === resp.selectedAlt;

      levels.forEach((level, attrName) => {
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
        utilities[key] = 0;
        levelUtils.push(0);
      } else {
        const selectionRate = chosen / total;
        const adjustedRate = Math.max(0.01, Math.min(0.99, selectionRate));
        const utility = Math.log(adjustedRate / (1 - adjustedRate));

        utilities[key] = utility;
        levelUtils.push(utility);
      }
    });

    const denom = levelUtils.length || 1;
    const meanUtil = levelUtils.reduce((a, b) => a + b, 0) / denom;
    attr.levels.forEach((level) => {
      const key = `${attr.name}:${level}`;
      utilities[key] = utilities[key] - meanUtil;
    });

    const normalizedUtils = attr.levels.map((level) => utilities[`${attr.name}:${level}`]);

    const maxUtil = Math.max(...normalizedUtils);
    const minUtil = Math.min(...normalizedUtils);
    const range = maxUtil - minUtil;
    importances[attr.name] = range;
  });

  const totalImportance = Object.values(importances).reduce((a, b) => a + b, 0);
  if (totalImportance > 0) {
    Object.keys(importances).forEach((attr) => {
      importances[attr] = (importances[attr] / totalImportance) * 100;
    });
  }

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

    await ensureTabExists(sheetId, token, "Attributes");

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

    const attributesMap = new Map<string, string[]>();
    const priceInfo = new Map<
      string,
      {
        isPriceAttribute: boolean;
        currency: string;
      }
    >();

    let lastName: string | null = null;
    let lastIsPriceAttr: string | null = null;
    let lastCurrency: string | null = null;

    for (let i = 1; i < attrRows.length; i++) {
      const row = attrRows[i];
      const rawName = (row[0] || "").trim();
      const rawLevel = (row[1] || "").trim();
      const rawIsPriceAttr = (row[2] || "").trim();
      const rawCurrency = (row[3] || "").trim();

      const effectiveName = rawName || lastName;
      if (!effectiveName) continue;

      if (rawName) {
        lastName = rawName;
        lastIsPriceAttr = rawIsPriceAttr;
        lastCurrency = rawCurrency || "USD";

        if (!attributesMap.has(rawName)) {
          attributesMap.set(rawName, []);
        }

        if (rawIsPriceAttr === "TRUE") {
          priceInfo.set(rawName, {
            isPriceAttribute: true,
            currency: lastCurrency,
          });
        }
      }

      if (rawLevel) {
        const targetName = effectiveName;
        if (!attributesMap.has(targetName)) {
          attributesMap.set(targetName, []);
        }
        attributesMap.get(targetName)!.push(rawLevel);
      }
    }

    const attributes: Attribute[] = Array.from(attributesMap.entries()).map(([name, levels]) => {
      const info = priceInfo.get(name) || { isPriceAttribute: false, currency: "USD" };
      return {
        name,
        levels,
        isPriceAttribute: info.isPriceAttribute,
        currency: info.currency,
      };
    });

    if (attributes.length === 0) {
      throw new Error(
        "Parsed 0 attributes from the Attributes tab. Check that your Attributes sheet has names and levels configured.",
      );
    }

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
      return new Response(
        JSON.stringify({
          error: "No responses found",
          message:
            "No survey responses have been collected yet. Share your survey links and come back once respondents have completed the survey.",
          noResponses: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const allResponses: Response[] = respRows.slice(1).map((row: string[]) => ({
      responseId: row[0],
      surveyId: row[1],
      taskId: row[2],
      selectedAlt: parseInt(row[3]),
    }));

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

    // -----------------------------
    // Parse Design with canonical names/levels
    // -----------------------------
    const headerRow = designRows[0];
    const rawAttrHeaders = headerRow.slice(2);
    const headerNameMap = buildAttrNameMap(attributes, rawAttrHeaders);
    const canonicalAttrHeaders = rawAttrHeaders.map((h) => headerNameMap[h] || h);

    const designMap = new Map<string, Map<number, Map<string, string>>>();
    const noneAlternatives = new Map<string, number>();

    for (let i = 1; i < designRows.length; i++) {
      const row = designRows[i];
      const taskId = row[0];
      const altId = parseInt(row[1]);

      if (!taskId || isNaN(altId)) continue;

      if (!designMap.has(taskId)) {
        designMap.set(taskId, new Map());
      }

      const altLevels = new Map<string, string>();
      let isNoneAlt = true;

      for (let j = 0; j < canonicalAttrHeaders.length && j < row.length - 2; j++) {
        const attrName = canonicalAttrHeaders[j];
        const rawLevel = row[j + 2];
        const level = canonicalLevel(attrName, rawLevel, attributes);

        if (attrName && level) {
          altLevels.set(attrName, level);
          if (level !== "None of these") {
            isNoneAlt = false;
          }
        }
      }

      designMap.get(taskId)!.set(altId, altLevels);

      if (isNoneAlt) {
        noneAlternatives.set(taskId, altId);
      }
    }

    console.log(`Parsed ${designMap.size} tasks with design data`);
    console.log(`Identified ${noneAlternatives.size} "None" alternatives across tasks`);

    const responses = allResponses.filter((resp) => {
      const noneAltIndex = noneAlternatives.get(resp.taskId);
      return noneAltIndex === undefined || resp.selectedAlt !== noneAltIndex;
    });

    const filteredCount = allResponses.length - responses.length;
    console.log(`Filtered out ${filteredCount} "None" responses`);

    const uniqueResponseIds = new Set(responses.map((r) => r.responseId));
    const totalUniqueResponses = uniqueResponseIds.size;

    console.log(
      `Analyzing ${responses.length} response rows from ${totalUniqueResponses} unique respondents (${filteredCount} "None" responses excluded)`,
    );

    if (designMap.size === 0) {
      throw new Error("No valid design data found. Cannot calculate utilities without task design information.");
    }

    const totalLevels = attributes.reduce((sum, a) => sum + a.levels.length, 0);
    const tasksPerRespondent = designMap.size || 1;

    let alternativesPerTask = 0;
    for (const [taskId, altMap] of designMap) {
      const noneAltIndex = noneAlternatives.get(taskId);
      alternativesPerTask = Array.from(altMap.keys()).filter((altId) => altId !== noneAltIndex).length;
      break;
    }
    if (!alternativesPerTask || alternativesPerTask <= 0) {
      alternativesPerTask = 2;
    }

    const baseN80 = Math.ceil((500 * totalLevels) / (tasksPerRespondent * alternativesPerTask));

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

    const results = runConjointAnalysis(responses, attributes, designMap, numPlans, pricingStrategy, goal);

    results.totalResponses = totalUniqueResponses;

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
    const analysisTabName = `Analysis_${timestamp}`;

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

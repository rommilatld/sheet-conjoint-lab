// @ts-ignore - Supabase edge runtime types
import { getGoogleSheetsToken } from "../_shared/google-sheets.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ICON MAP — case-insensitive, matches spreadsheet levels
const ICON_MAP: Record<string, string> = {
  included: "✔️",
  "not included": "❌",
  "none of these": "🚫",
  unlimited: "♾️",
  premium: "💎",
  basic: "📦",
};

// Case-insensitive icon transformer
function mapLevelToIcon(level: string): string {
  if (!level) return level;
  const key = level.trim().toLowerCase();
  return ICON_MAP[key] || level; // fallback to raw text
}

async function decryptSurveyToken(token: string): Promise<{ sheetId: string; surveyId: string }> {
  const encryptionSecret = Deno.env.get("ENCRYPTION_SECRET");
  if (!encryptionSecret) throw new Error("Missing encryption secret");

  try {
    let base64 = token.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) base64 += "=";

    const binaryString = atob(base64);
    const combined = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) combined[i] = binaryString.charCodeAt(i);

    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const encoder = new TextEncoder();
    const keyData = encoder.encode(encryptionSecret.slice(0, 32));
    const key = await crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, false, ["decrypt"]);

    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Invalid survey token");
  }
}

// CALCULATE OPTIMAL TASK COUNT (LIMIT 3–5)
function calculateOptimalTaskCount(attributes: any[]): number {
  const attributeCount = attributes.length;
  const avgLevels = attributes.reduce((sum, attr) => sum + attr.levels.length, 0) / attributeCount;

  let optimalTasks = Math.round(attributeCount * avgLevels * 0.8);
  optimalTasks = Math.max(3, Math.min(5, optimalTasks));

  console.log(`Calculated ${optimalTasks} tasks for ${attributeCount} attributes (avg levels ${avgLevels.toFixed(1)})`);
  return optimalTasks;
}

function generateRandomTasks(attributes: any[], numTasks: number, numAlternatives = 3) {
  const tasks = [];

  const areAlternativesEqual = (alt1: any, alt2: any): boolean =>
    attributes.every((attr) => alt1[attr.name] === alt2[attr.name]);

  for (let t = 0; t < numTasks; t++) {
    const alternatives: any[] = [];

    for (let a = 0; a < numAlternatives; a++) {
      let attempts = 0;
      let alternative: any;

      do {
        alternative = {};
        attributes.forEach((attr) => {
          const randomLevel = attr.levels[Math.floor(Math.random() * attr.levels.length)];

          // apply icon mapping
          alternative[attr.name] = mapLevelToIcon(randomLevel);
        });
        attempts++;
      } while (attempts < 50 && alternatives.some((existing) => areAlternativesEqual(existing, alternative)));

      alternatives.push(alternative);
    }

    // "None of these" always icon-mapped
    const noneAlternative: any = {};
    attributes.forEach((attr) => {
      noneAlternative[attr.name] = mapLevelToIcon("None of these");
    });
    alternatives.push(noneAlternative);

    tasks.push({ taskId: t + 1, alternatives });
  }

  return tasks;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { surveyToken } = await req.json();
    const { sheetId, surveyId } = await decryptSurveyToken(surveyToken);
    const token = await getGoogleSheetsToken();

    // Load survey metadata
    const surveyMetaResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Surveys!A:F`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    let introduction = "";
    let question = "Which subscription plan would you prefer?";

    if (surveyMetaResponse.ok) {
      const surveyMetaData = await surveyMetaResponse.json();
      const surveyRows = surveyMetaData.values || [];
      const surveyRow = surveyRows.find((row: string[]) => row[0] === surveyId);

      if (surveyRow) {
        if (surveyRow.length >= 4 && surveyRow[3]) introduction = surveyRow[3];
        if (surveyRow.length >= 5 && surveyRow[4]) question = surveyRow[4];
      }
    }

    // Load attributes from Google Sheets
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Attributes!A:B`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error("Failed to read attributes from Google Sheets");

    const data = await response.json();
    const rows = data.values || [];
    const attributesMap = new Map();

    for (let i = 1; i < rows.length; i++) {
      const [name, level] = rows[i];
      if (name && level) {
        if (!attributesMap.has(name)) attributesMap.set(name, []);
        attributesMap.get(name).push(level);
      }
    }

    // attributes mapped ONCE here (so levels contain icons now)
    const attributes = Array.from(attributesMap.entries()).map(([name, levels]) => ({
      name,
      levels: levels.map((l: string) => mapLevelToIcon(l)),
    }));

    if (attributes.length === 0) throw new Error("No attributes found for this survey");

    // Generate tasks
    const optimalTaskCount = calculateOptimalTaskCount(attributes);
    const tasks = generateRandomTasks(attributes, optimalTaskCount, 3);

    // Save design sheet if needed
    try {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: "Design" } } }] }),
      });
    } catch (e) {}

    const existingDesignResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Design!A:A`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    let designExists = false;
    if (existingDesignResponse.ok) {
      const existingData = await existingDesignResponse.json();
      const existingRows = existingData.values || [];
      designExists = existingRows.some((row: string[]) => row[0] && row[0].startsWith(`${surveyId}_`));
    }

    if (!designExists) {
      const designRows: any[][] = [];
      const attrNames = attributes.map((a) => a.name);
      designRows.push(["TaskID", "AltID", ...attrNames]);

      tasks.forEach((task) => {
        task.alternatives.forEach((alt: any, altIndex: number) => {
          const row = [
            `${surveyId}_task${task.taskId}`,
            altIndex.toString(),
            ...attrNames.map((name) => alt[name] || ""),
          ];
          designRows.push(row);
        });
      });

      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Design!A:Z:append?valueInputOption=RAW`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ values: designRows }),
        },
      );
    }

    return new Response(JSON.stringify({ surveyId, tasks, attributes, introduction, question }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error loading survey:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

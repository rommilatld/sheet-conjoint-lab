// @ts-ignore - Supabase edge runtime types
import { getGoogleSheetsToken } from "../_shared/google-sheets.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* -------------------------------------------------------
   ICON MAP (HTML encoded & color styled)
------------------------------------------------------- */
const ICON_MAP: Record<string, string> = {
  included: "&lt;span style='color:green'>&#10004;&lt;/span>",
  "not included": "&lt;span style='color:red'>&#10008;&lt;/span>",
  "none of these": "&lt;span style='color:gray'>&#8212;&lt;/span>",
  unlimited: "&#8734;",
  premium: "&lt;span style='color:gold'>&#9733;&lt;/span>",
  basic: "&lt;span style='color:gray'>&#8226;&lt;/span>",
};

function mapLevelToIcon(level: string): string {
  if (!level) return level;
  const key = level.trim().toLowerCase();
  return ICON_MAP[key] || level;
}

/* -------------------------------------------------------
   SURVEY TOKEN DECRYPT
------------------------------------------------------- */
async function decryptSurveyToken(token: string): Promise<{ sheetId: string; surveyId: string }> {
  const encryptionSecret = Deno.env.get("ENCRYPTION_SECRET");
  if (!encryptionSecret) throw new Error("Missing encryption secret");

  try {
    let base64 = token.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) base64 += "=";

    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    const iv = bytes.slice(0, 12);
    const encrypted = bytes.slice(12);

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(encryptionSecret.slice(0, 32)),
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch {
    throw new Error("Invalid survey token");
  }
}

/* -------------------------------------------------------
   ALWAYS Generate Exactly 5 Tasks
------------------------------------------------------- */
const FIXED_TASK_COUNT = 5;

/* -------------------------------------------------------
   GENERATE TASKS
------------------------------------------------------- */
function generateRandomTasks(attributes: any[], numTasks: number, numAlternatives = 3) {
  const tasks = [];

  const areEqual = (a: any, b: any) => attributes.every((attr) => a[attr.name] === b[attr.name]);

  for (let t = 0; t < numTasks; t++) {
    const alternatives: any[] = [];

    for (let a = 0; a < numAlternatives; a++) {
      let alt: Record<string, string> = {};

      let attempts = 0;
      do {
        alt = {};
        attributes.forEach((attr: any) => {
          const level = attr.levels[Math.floor(Math.random() * attr.levels.length)];
          alt[attr.name] = mapLevelToIcon(level);
        });
        attempts++;
      } while (attempts < 50 && alternatives.some((existing) => areEqual(existing, alt)));

      alternatives.push(alt);
    }

    // None of these
    const none: Record<string, string> = {};
    attributes.forEach((attr: any) => {
      none[attr.name] = mapLevelToIcon("None of these");
    });
    alternatives.push(none);

    tasks.push({ taskId: t + 1, alternatives });
  }

  return tasks;
}

/* -------------------------------------------------------
   MAIN HANDLER
------------------------------------------------------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { surveyToken } = await req.json();
    const { sheetId, surveyId } = await decryptSurveyToken(surveyToken);
    const token = await getGoogleSheetsToken();

    /* -------------------------------------------------------
       LOAD SURVEY META (intro + question + maxTasks)
    ------------------------------------------------------- */
    let introduction = "";
    let question = "Which subscription plan would you prefer?";
    let maxTasks = 5; // Default value

    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Surveys!A:F`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (metaRes.ok) {
      const meta = await metaRes.json();
      const rows = meta.values || [];
      const row = rows.find((r: string[]) => r[0] === surveyId);

      if (row) {
        if (row[3]) introduction = row[3];
        if (row[4]) question = row[4];
        if (row[5]) maxTasks = parseInt(row[5]) || 5;
      }
    }

    /* -------------------------------------------------------
       LOAD ATTRIBUTES
    ------------------------------------------------------- */
    const attrRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Attributes!A:F`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!attrRes.ok) throw new Error("Failed to read attributes");

    const attrData = await attrRes.json();
    const rows = attrData.values || [];

    const attributesMap = new Map<string, any>();

    for (let i = 1; i < rows.length; i++) {
      const [name, level, isPriceAttr, currency, description, type] = rows[i];
      if (!name || !level) continue;

      if (!attributesMap.has(name)) {
        attributesMap.set(name, {
          name,
          levels: [],
          description: description || "",
          type: type || "standard",
        });
      }
      attributesMap.get(name)!.levels.push(level);
    }

    const attributes = Array.from(attributesMap.values());

    if (attributes.length === 0) throw new Error("No attributes configured");

    /* -------------------------------------------------------
       CHECK IF DESIGN EXISTS
    ------------------------------------------------------- */
    const designCheck = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Design!A:A`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    let designExists = false;
    if (designCheck.ok) {
      const designRows = (await designCheck.json()).values || [];
      designExists = designRows.some((r: string[]) => r[0]?.startsWith(`${surveyId}_`));
    }

    /* -------------------------------------------------------
       HANDLE DESIGN CREATION IF NOT EXISTS
    ------------------------------------------------------- */
    if (!designExists) {
      // Try to create Design sheet if missing
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [{ addSheet: { properties: { title: "Design" } } }],
        }),
      }).catch(() => {});

      const tasks = generateRandomTasks(attributes, FIXED_TASK_COUNT, 3);

      const header = ["TaskID", "AltID", ...attributes.map((a) => a.name)];
      const designRows: any[][] = [header];

      tasks.forEach((task) => {
        task.alternatives.forEach((alt: any, altIdx: number) => {
          designRows.push([`${surveyId}_task${task.taskId}`, altIdx, ...attributes.map((a) => alt[a.name] || "")]);
        });
      });

      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Design!A:Z:append?valueInputOption=RAW`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ values: designRows }),
        },
      );

      return new Response(JSON.stringify({ surveyId, tasks, attributes, introduction, question }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    /* -------------------------------------------------------
       DESIGN EXISTS → LOAD IT
    ------------------------------------------------------- */
    const designRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Design!A:Z`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const designData = await designRes.json();
    const dRows = designData.values || [];

    const tasksMap = new Map<number, any[]>();

    const attrNames = dRows[0].slice(2);

    for (let i = 1; i < dRows.length; i++) {
      const row = dRows[i];
      const taskIdStr = row[0];
      if (!taskIdStr.startsWith(`${surveyId}_task`)) continue;

      const taskId = parseInt(taskIdStr.replace(`${surveyId}_task`, ""));
      const altId = parseInt(row[1]);

      const alt: any = {};
      for (let j = 0; j < attrNames.length; j++) {
        alt[attrNames[j]] = row[j + 2];
      }

      if (!tasksMap.has(taskId)) tasksMap.set(taskId, []);
      tasksMap.get(taskId)!.push(alt);
    }

    const tasks = Array.from(tasksMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([taskId, alternatives]) => ({ 
        taskId, 
        // Cap at 3 options + none (4 total)
        alternatives: alternatives.slice(0, 4)
      }));

    // Apply maxTasks cap
    const cappedTasks = tasks.slice(0, maxTasks);

    return new Response(JSON.stringify({ surveyId, tasks: cappedTasks, attributes, introduction, question }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

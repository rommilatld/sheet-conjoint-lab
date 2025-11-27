// @ts-ignore - Supabase edge runtime types

import { decryptSurveyToken } from "../_shared/survey-token.ts";
import { getGoogleSheetsToken } from "../_shared/google-sheets.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Attribute {
  name: string;
  levels: string[];
}

interface TaskAlternative {
  id: number;
  levels: { [key: string]: string };
}

interface Task {
  id: number;
  alternatives: TaskAlternative[];
  noneAlternativeId: number | null;
}

const ICON_MAP: Record<string, string> = {
  "✕": "✕",
  "✓": "✓",
  No: "✕",
  Yes: "✓",
  "0": "✕",
  "1": "✓",
};

function mapLevelToIcon(level: string): string {
  const trimmed = (level || "").trim();
  for (const [key, icon] of Object.entries(ICON_MAP)) {
    const parts = key.split("|");
    if (parts.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
      return icon;
    }
  }
  return trimmed || "";
}

function generateRandomTasks(attributes: Attribute[], numTasks: number, altsPerTask: number): Task[] {
  const tasks: Task[] = [];

  for (let t = 0; t < numTasks; t++) {
    const taskId = t + 1;
    const alternatives: TaskAlternative[] = [];

    // Generate the "real" alternatives
    for (let a = 0; a < altsPerTask; a++) {
      const levels: { [key: string]: string } = {};
      attributes.forEach((attr) => {
        const randomLevel = attr.levels[Math.floor(Math.random() * attr.levels.length)];
        levels[attr.name] = randomLevel;
      });

      alternatives.push({
        id: a + 1,
        levels,
      });
    }

    // Add a "None of these" alternative with id = altsPerTask + 1
    const noneLevels: { [key: string]: string } = {};
    attributes.forEach((attr) => {
      noneLevels[attr.name] = "None of these";
    });

    alternatives.push({
      id: altsPerTask + 1,
      levels: noneLevels,
    });

    tasks.push({
      id: taskId,
      alternatives,
      noneAlternativeId: altsPerTask + 1,
    });
  }

  return tasks;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      throw new Error("Missing token");
    }

    const { sheetId, surveyId } = await decryptSurveyToken(token);
    const gsToken = await getGoogleSheetsToken();

    // Load Config
    const configResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Config!A1:B10`,
      {
        headers: { Authorization: `Bearer ${gsToken}` },
      },
    );

    let introduction = "";
    let question = "Which subscription plan would you prefer?";
    let numTasks = 5;

    if (configResponse.ok) {
      const configData = await configResponse.json();
      const rows: string[][] = configData.values || [];

      rows.forEach((row) => {
        const key = row[0];
        const value = row[1];
        if (!key) return;

        if (key === "Introduction") introduction = value;
        if (key === "Question") question = value;
        if (key === "NumTasks" && !isNaN(parseInt(value))) numTasks = parseInt(value);
      });
    }

    // Load Attributes
    const attrResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Attributes!A:B`, {
      headers: { Authorization: `Bearer ${gsToken}` },
    });

    if (!attrResponse.ok) {
      throw new Error("Failed to load Attributes");
    }

    const attrData = await attrResponse.json();
    const attrRows: string[][] = attrData.values || [];

    if (attrRows.length <= 1) {
      throw new Error("No attributes configured. Please set up attributes first.");
    }

    const attributesMap = new Map<string, string[]>();
    let lastName: string | null = null;

    for (let i = 1; i < attrRows.length; i++) {
      const row = attrRows[i];
      const name = (row[0] || "").trim();
      const level = (row[1] || "").trim();

      if (name) {
        lastName = name;
        if (!attributesMap.has(name)) attributesMap.set(name, []);
      }

      if (level && lastName) {
        attributesMap.get(lastName)!.push(level);
      }
    }

    const attributes: Attribute[] = Array.from(attributesMap.entries()).map(([name, levels]) => ({
      name,
      levels,
    }));

    if (attributes.length === 0) {
      throw new Error("Parsed 0 attributes from Attributes tab.");
    }

    // Try to load existing Design sheet
    const designResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Design!A:Z`, {
      headers: { Authorization: `Bearer ${gsToken}` },
    });

    let tasks: Task[] = [];

    if (!designResponse.ok) {
      // No Design sheet yet: generate a fresh design and write it
      tasks = generateRandomTasks(attributes, numTasks, 3);

      const headerRow = ["TaskID", "AltID", ...attributes.map((a) => a.name)];
      const designRows: any[] = [headerRow];

      tasks.forEach((task) => {
        task.alternatives.forEach((alt) => {
          const row: any[] = [`${surveyId}_task${task.id}`, alt.id];
          attributes.forEach((attr) => {
            const rawLevel = alt.levels[attr.name] || "";
            row.push(mapLevelToIcon(rawLevel));
          });
          designRows.push(row);
        });
      });

      try {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${gsToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: {
                    title: "Design",
                  },
                },
              },
            ],
          }),
        });
      } catch (_e) {
        // Sheet may already exist, continue
      }

      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Design!A1?valueInputOption=RAW`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${gsToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: designRows }),
      });
    } else {
      // Design sheet exists - reuse it, but map columns to current Attributes
      const designData = await designResponse.json();
      const dRows: string[][] = designData.values || [];

      if (dRows.length <= 1) {
        // No usable data, regenerate design
        tasks = generateRandomTasks(attributes, numTasks, 3);

        const headerRow = ["TaskID", "AltID", ...attributes.map((a) => a.name)];
        const designRows: any[] = [headerRow];

        tasks.forEach((task) => {
          task.alternatives.forEach((alt) => {
            const row: any[] = [`${surveyId}_task${task.id}`, alt.id];
            attributes.forEach((attr) => {
              const rawLevel = alt.levels[attr.name] || "";
              row.push(mapLevelToIcon(rawLevel));
            });
            designRows.push(row);
          });
        });

        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Design!A1?valueInputOption=RAW`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${gsToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ values: designRows }),
        });
      } else {
        // Map rows back into Task[] using Attributes for column mapping
        const tasksMap = new Map<number, TaskAlternative[]>();
        const attrNames = attributes.map((a) => a.name);

        for (let i = 1; i < dRows.length; i++) {
          const row = dRows[i];
          const taskIdStr = row[0];
          if (!taskIdStr.startsWith(`${surveyId}_task`)) continue;

          const taskId = parseInt(taskIdStr.replace(`${surveyId}_task`, ""));
          const altId = parseInt(row[1]);

          const alt: any = {};
          for (let j = 0; j < attrNames.length && j + 2 < row.length; j++) {
            alt[attrNames[j]] = row[j + 2];
          }

          if (!tasksMap.has(taskId)) tasksMap.set(taskId, []);
          tasksMap.get(taskId)!.push(alt);
        }

        tasks = Array.from(tasksMap.entries()).map(([id, alts]) => {
          let noneId: number | null = null;
          const alternatives: TaskAlternative[] = alts.map((levels, idx) => {
            const altId = idx + 1;
            const isNone = Object.values(levels).every((v) => v === "None of these");
            if (isNone) noneId = altId;
            return { id: altId, levels: levels as any };
          });

          if (noneId === null) {
            const noneLevels: any = {};
            attributes.forEach((attr) => {
              noneLevels[attr.name] = "None of these";
            });
            noneId = alternatives.length + 1;
            alternatives.push({ id: noneId, levels: noneLevels });
          }

          return { id, alternatives, noneAlternativeId: noneId };
        });
      }
    }

    return new Response(
      JSON.stringify({
        introduction,
        question,
        tasks,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error loading survey:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

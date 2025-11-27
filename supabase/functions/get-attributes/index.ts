// @ts-ignore - Supabase edge runtime types

import { getGoogleSheetsToken, decryptProjectKey } from "../_shared/google-sheets.ts";
import { getAttributes as getFromMemory } from "../_shared/in-memory-store.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectKey } = await req.json();
    console.log("Getting attributes");

    const sheetId = await decryptProjectKey(projectKey);

    // Try Google Sheets first, fall back to in-memory storage
    try {
      const token = await getGoogleSheetsToken();

      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Attributes!A:F`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Sheets API error:", {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(`Failed to read from Google Sheets: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const rows = data.values || [];

      // ---------------------------------------------------------------------
      // FIX: Robust parsing for Sheets with merged attribute names
      // ---------------------------------------------------------------------
      const attributesMap = new Map();
      const metadataMap = new Map();

      let lastName: string | null = null;
      let lastMeta: any = null;

      for (let i = 1; i < rows.length; i++) {
        const [name, level, isPriceAttr, currency, description, type] = rows[i];

        const cleanName = (name || "").trim();
        const cleanLevel = (level || "").trim();

        // Use last seen attribute name if current row name is blank (merged cells)
        const effectiveName = cleanName || lastName;
        if (!effectiveName) continue; // still empty → skip row

        // New attribute block when name is not empty
        if (cleanName) {
          lastName = cleanName;
          lastMeta = {
            isPriceAttribute: isPriceAttr === "TRUE",
            currency: currency || "USD",
            description: description || "",
            type: type || "standard",
          };

          if (!attributesMap.has(cleanName)) {
            attributesMap.set(cleanName, []);
            metadataMap.set(cleanName, lastMeta);
          }
        }

        // Add level (even if name cell was blank)
        if (cleanLevel) {
          attributesMap.get(effectiveName).push(cleanLevel);
        }
      }

      // Final output array
      const attributes = Array.from(attributesMap.entries()).map(([name, levels]) => {
        const meta = metadataMap.get(name) || {};
        return {
          name,
          levels,
          isPriceAttribute: meta.isPriceAttribute || false,
          currency: meta.currency || "USD",
          description: meta.description || "",
          type: meta.type || "standard",
        };
      });

      console.log(`Loaded ${attributes.length} attributes from Google Sheets`);

      return new Response(JSON.stringify({ attributes }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } catch (googleError) {
      console.warn("Google Sheets read failed, using in-memory storage:", googleError);

      const attributes = getFromMemory(sheetId);

      console.log(`Loaded ${attributes.length} attributes from in-memory storage`);

      return new Response(JSON.stringify({ attributes }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
  } catch (error) {
    console.error("Error getting attributes:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

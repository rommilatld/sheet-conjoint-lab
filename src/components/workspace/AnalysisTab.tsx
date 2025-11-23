import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AnalysisTabProps {
  projectKey: string;
}

interface AnalysisResults {
  importances: { [key: string]: number };
  utilities: { [key: string]: number };
  totalResponses: number;
  analysisTabName: string;
}

export const AnalysisTab = ({ projectKey }: AnalysisTabProps) => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const { toast } = useToast();

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('run-analysis', {
        body: { projectKey },
      });

      if (error) {
        throw new Error(error.message || "Failed to run analysis");
      }

      if (!data || !data.results) {
        throw new Error("No analysis results returned");
      }

      setResults(data.results);
      
      toast({
        title: "Analysis Complete!",
        description: `Results saved to ${data.results.analysisTabName} tab in your Google Sheet`,
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-card p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-2">Conjoint Analysis</h2>
          <p className="text-sm text-muted-foreground">
            Run statistical analysis on your survey responses to calculate attribute importances and utilities
          </p>
        </div>

        <Button
          onClick={runAnalysis}
          disabled={loading}
          className="gradient-primary"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Running Analysis...
            </>
          ) : (
            <>
              <TrendingUp className="mr-2 h-5 w-5" />
              Analyze Results
            </>
          )}
        </Button>

        {!results && !loading && (
          <div className="mt-8 rounded-lg bg-muted/50 p-6">
            <h3 className="mb-3 text-lg font-semibold">What This Does</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Reads all survey responses from your Google Sheet</li>
              <li>• Calculates attribute importances (which features matter most)</li>
              <li>• Estimates part-worth utilities for each attribute level</li>
              <li>• Saves detailed results to a new Analysis tab in your sheet</li>
            </ul>
          </div>
        )}
      </Card>

      {results && (
        <Card className="shadow-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-semibold">Analysis Results</h3>
          </div>

          <div className="space-y-6">
            <div>
              <div className="mb-4 rounded-lg bg-accent/10 p-4">
                <p className="text-sm text-muted-foreground">
                  Based on <span className="font-semibold text-foreground">{results.totalResponses}</span> responses
                </p>
              </div>

              <h4 className="mb-3 text-lg font-semibold">Attribute Importances</h4>
              <p className="mb-4 text-xs text-muted-foreground">
                Shows which attributes have the most influence on choices
              </p>
              <div className="space-y-3">
                {Object.entries(results.importances)
                  .sort(([, a], [, b]) => b - a)
                  .map(([attr, importance]) => (
                    <div key={attr} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{attr}</span>
                        <span className="text-muted-foreground">{importance.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${importance}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <h4 className="mb-3 text-lg font-semibold">Part-Worth Utilities</h4>
              <p className="mb-4 text-xs text-muted-foreground">
                Higher values indicate more preferred attribute levels
              </p>
              <div className="rounded-lg border">
                <div className="grid grid-cols-2 gap-px bg-border">
                  <div className="bg-muted px-4 py-2 font-semibold text-sm">
                    Attribute:Level
                  </div>
                  <div className="bg-muted px-4 py-2 font-semibold text-sm text-right">
                    Utility
                  </div>
                  {Object.entries(results.utilities).map(([key, utility]) => (
                    <>
                      <div className="bg-background px-4 py-2 text-sm">
                        {key}
                      </div>
                      <div className="bg-background px-4 py-2 text-sm text-right font-mono">
                        {utility.toFixed(3)}
                      </div>
                    </>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-accent/10 p-4">
              <p className="text-sm">
                <strong>Note:</strong> Full results have been saved to the{" "}
                <span className="font-mono text-xs">{results.analysisTabName}</span> tab in your Google Sheet
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
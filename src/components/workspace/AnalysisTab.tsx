import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, TrendingUp, BarChart3, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";

interface AnalysisTabProps {
  projectKey: string;
}

interface Plan {
  name: string;
  features: { [key: string]: string };
  suggestedPrice: number;
  willingnessToPay: number;
}

interface AnalysisResults {
  importances: { [key: string]: number };
  utilities: { [key: string]: number };
  totalResponses: number;
  analysisTabName: string;
  plans: Plan[];
}

export const AnalysisTab = ({ projectKey }: AnalysisTabProps) => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [numPlans, setNumPlans] = useState<number>(3);
  const { toast } = useToast();

  const downloadPDF = () => {
    if (!results) return;

    const doc = new jsPDF();
    let yPos = 20;

    // Title
    doc.setFontSize(18);
    doc.text("Plan Builder Analysis Report", 20, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.text(`Total Responses: ${results.totalResponses}`, 20, yPos);
    yPos += 10;
    doc.text(`Analysis Date: ${new Date().toLocaleDateString()}`, 20, yPos);
    yPos += 15;

    // Attribute Importances
    doc.setFontSize(14);
    doc.text("Attribute Importances", 20, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    Object.entries(results.importances)
      .sort(([, a], [, b]) => b - a)
      .forEach(([attr, importance]) => {
        doc.text(`${attr}: ${importance.toFixed(1)}%`, 25, yPos);
        yPos += 6;
      });
    yPos += 10;

    // Plans
    if (results.plans && results.plans.length > 0) {
      doc.setFontSize(14);
      doc.text("Recommended Plans", 20, yPos);
      yPos += 8;

      results.plans.forEach((plan, idx) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(12);
        doc.text(`${plan.name}`, 25, yPos);
        yPos += 6;
        
        doc.setFontSize(10);
        doc.text(`Suggested Price: $${plan.suggestedPrice}/month`, 30, yPos);
        yPos += 5;
        doc.text(`Willingness to Pay: $${plan.willingnessToPay.toFixed(2)}/month`, 30, yPos);
        yPos += 7;

        doc.text("Features:", 30, yPos);
        yPos += 5;
        Object.entries(plan.features).forEach(([attr, level]) => {
          doc.text(`• ${attr}: ${level}`, 35, yPos);
          yPos += 5;
        });
        yPos += 5;
      });
    }

    doc.save("plan-builder-analysis.pdf");
    
    toast({
      title: "PDF Downloaded",
      description: "Analysis report has been downloaded successfully",
    });
  };

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('run-analysis', {
        body: { projectKey, numPlans },
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
            Run statistical analysis on your survey responses to calculate attribute importances and generate pricing plans
          </p>
        </div>

        <div className="mb-6 max-w-xs">
          <Label htmlFor="numPlans">Number of Plans to Generate</Label>
          <Input
            id="numPlans"
            type="number"
            min="1"
            max="10"
            value={numPlans}
            onChange={(e) => setNumPlans(parseInt(e.target.value) || 3)}
            className="mt-2"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Generate good, better, best pricing plans (1-10 plans)
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
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-semibold">Analysis Results</h3>
            </div>
            <Button onClick={downloadPDF} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
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

            {results.plans && results.plans.length > 0 && (
              <div>
                <h4 className="mb-3 text-lg font-semibold">Recommended Plans</h4>
                <p className="mb-4 text-xs text-muted-foreground">
                  Pricing plans optimized based on feature utilities and willingness to pay
                </p>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {results.plans.map((plan, idx) => (
                    <Card key={idx} className="p-6 border-2 border-primary/20 hover:border-primary/40 transition-colors">
                      <h5 className="text-lg font-bold mb-2">{plan.name}</h5>
                      <div className="mb-4">
                        <div className="text-3xl font-bold text-primary">${plan.suggestedPrice}</div>
                        <div className="text-sm text-muted-foreground">/month</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          WTP: ${plan.willingnessToPay.toFixed(2)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase">Features:</p>
                        {Object.entries(plan.features).map(([attr, level]) => (
                          <div key={attr} className="text-sm">
                            <span className="font-medium">{attr}:</span> {level}
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

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
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronRight, ChevronLeft, Save, Loader2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Attribute {
  name: string;
  description?: string;
  type?: "standard" | "included-not-included";
  levels: string[];
}

interface SurveyPreviewProps {
  attributes: Attribute[];
  projectKey: string;
}

interface Alternative {
  [key: string]: string;
}

export const SurveyPreview = ({ attributes, projectKey }: SurveyPreviewProps) => {
  const [currentTask, setCurrentTask] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [introduction, setIntroduction] = useState("");
  const [question, setQuestion] = useState("Which subscription plan would you prefer?");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Calculate recommended sample sizes based on study complexity
  const calculateSampleSizes = () => {
    const numAttributes = attributes.length;
    const maxLevels = Math.max(...attributes.map((attr) => attr.levels.length));
    const totalLevels = attributes.reduce((sum, attr) => sum + attr.levels.length, 0);

    // Rule of thumb: 300-500 responses per attribute for high confidence
    // Adjusted by complexity (max levels and total parameters)
    const complexityFactor = Math.max(numAttributes, maxLevels * 0.5);

    const high = Math.ceil(complexityFactor * 100);
    const medium = Math.ceil(complexityFactor * 60);
    const low = Math.ceil(complexityFactor * 30);

    return {
      high: Math.max(300, Math.min(high, 1000)),
      medium: Math.max(200, Math.min(medium, 600)),
      low: Math.max(100, Math.min(low, 300)),
    };
  };

  const sampleSizes = calculateSampleSizes();

  useEffect(() => {
    loadConfig();
  }, [projectKey]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-survey-config", {
        body: { projectKey },
      });

      if (!error && data) {
        if (data.introduction) {
          setIntroduction(data.introduction);
        }
        if (data.question) {
          setQuestion(data.question);
        }
      }
    } catch (error) {
      console.error("Failed to load config:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!introduction.trim()) {
      toast({
        title: "Error",
        description: "Please enter an introduction",
        variant: "destructive",
      });
      return;
    }

    if (!question.trim()) {
      toast({
        title: "Error",
        description: "Please enter a question",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("save-survey-config", {
        body: {
          projectKey,
          introduction: introduction.trim(),
          question: question.trim(),
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to save configuration");
      }

      toast({
        title: "Saved!",
        description: "Survey configuration has been saved successfully",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Generate random alternatives for preview - memoized to prevent regeneration on re-render
  const [tasks] = useState(() => {
    const generateAlternatives = (count: number): Alternative[] => {
      const alternatives = Array.from({ length: count }, () => {
        const alt: Alternative = {};
        attributes.forEach((attr) => {
          const randomLevel = attr.levels[Math.floor(Math.random() * attr.levels.length)];
          alt[attr.name] = randomLevel;
        });
        return alt;
      });

      // Add "None" option
      const noneAlt: Alternative = {};
      attributes.forEach((attr) => {
        noneAlt[attr.name] = "None of these";
      });
      alternatives.push(noneAlt);

      return alternatives;
    };

    // Generate 3 tasks with 3 alternatives each + None
    return Array.from({ length: 3 }, () => generateAlternatives(3));
  });

  const currentAlternatives = tasks[currentTask];
  const numOptions = currentAlternatives.length - 1; // Exclude None

  const handleNext = () => {
    if (currentTask < tasks.length - 1) {
      setCurrentTask(currentTask + 1);
      setSelectedOption(null);
    }
  };

  const handlePrevious = () => {
    if (currentTask > 0) {
      setCurrentTask(currentTask - 1);
      setSelectedOption(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-card p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-2">Survey Configuration</h2>
          <p className="text-muted-foreground">
            Configure the introduction and question that will appear in your survey
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="preview-introduction">Introduction</Label>
              <Textarea
                id="preview-introduction"
                placeholder="Write an introduction for your survey (2-3 paragraphs). This will be displayed at the top of the survey to provide context to respondents."
                value={introduction}
                onChange={(e) => setIntroduction(e.target.value)}
                className="min-h-[150px]"
              />
              <p className="text-xs text-muted-foreground">Provide context and instructions for survey respondents</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preview-question">Question</Label>
              <Input
                id="preview-question"
                placeholder="Which subscription plan would you prefer?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">This question will appear for each choice task</p>
            </div>

            <Button
              onClick={saveConfig}
              disabled={saving || !introduction.trim() || !question.trim()}
              className="w-full gradient-primary"
              size="lg"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </>
              )}
            </Button>
          </div>
        )}
      </Card>

      <Card className="shadow-card p-8">
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2">Survey Preview</h3>
          <p className="text-muted-foreground text-sm">This is how your survey will appear to respondents</p>
        </div>

        <div className="mb-6">
          <h4 className="text-base font-semibold mb-3">Attributes in Survey</h4>
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex flex-wrap gap-2">
              {attributes.map((attr, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-2 rounded-md bg-background px-3 py-1.5 text-sm border"
                >
                  <span className="font-medium">{attr.name}</span>
                  <span className="text-muted-foreground">({attr.levels.length} levels)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-lg bg-accent/5 border-primary/20 border p-5">
          <div className="mb-4">
            <h4 className="text-base font-semibold mb-2">Sample Size Guidelines</h4>
            <p className="text-xs text-muted-foreground">Recommended number of responses for statistical confidence</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
              <div>
                <div className="font-semibold">90% Confidence</div>
                <p className="text-xs text-muted-foreground mt-0.5">High precision for critical decisions</p>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-primary">{sampleSizes.high}</div>
                <p className="text-xs text-muted-foreground">responses</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
              <div>
                <div className="font-semibold">80% Confidence</div>
                <p className="text-xs text-muted-foreground mt-0.5">Good balance for most projects</p>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-primary">{sampleSizes.medium}</div>
                <p className="text-xs text-muted-foreground">responses</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
              <div>
                <div className="font-semibold">70% Confidence</div>
                <p className="text-xs text-muted-foreground mt-0.5">Acceptable for exploratory research</p>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-primary">{sampleSizes.low}</div>
                <p className="text-xs text-muted-foreground">responses</p>
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted-foreground italic">
            Calculated for {attributes.length} attributes with{" "}
            {attributes.reduce((sum, attr) => sum + attr.levels.length, 0)} total levels
          </p>
        </div>

        {introduction && (
          <div className="mb-6 p-4 rounded-lg bg-muted/50">
            <p className="text-base text-muted-foreground whitespace-pre-line leading-relaxed">{introduction}</p>
          </div>
        )}

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">
              Task {currentTask + 1} of {tasks.length}
            </h3>
            <div className="text-sm text-muted-foreground">Preview Mode</div>
          </div>
          <p className="text-base font-medium text-foreground mb-6">
            {question || "Which subscription plan would you prefer?"}
          </p>
        </div>

        {/* Table Preview */}
        <div className="overflow-x-auto mb-6">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="text-left p-3 font-semibold">Feature</th>
                <th className="text-left p-3 font-semibold">Description</th>
                {Array.from({ length: numOptions }, (_, i) => (
                  <th key={i} className="text-center p-3 font-semibold">
                    Option {String.fromCharCode(65 + i)}
                  </th>
                ))}
                <th className="text-center p-3 font-semibold">None</th>
              </tr>
            </thead>
            <tbody>
              {attributes.map((attr, attrIdx) => {
                const isIncludedType = attr.type === "included-not-included";

                return (
                  <tr key={attrIdx} className={`border-b border-border ${attrIdx % 2 === 0 ? "bg-muted/20" : ""}`}>
                    <td className="p-3 font-medium">{attr.name}</td>
                    <td className="p-3 text-sm text-muted-foreground">{attr.description || ""}</td>
                    {currentAlternatives.slice(0, numOptions).map((alt, altIdx) => {
                      const value = alt[attr.name];
                      const isIncluded = value === "Included";
                      const isNotIncluded = value === "Not Included";

                      return (
                        <td key={altIdx} className="p-3 text-center">
                          {isIncludedType ? (
                            isIncluded ? (
                              <Check className="h-5 w-5 text-green-600 mx-auto" />
                            ) : isNotIncluded ? (
                              <X className="h-5 w-5 text-red-600 mx-auto" />
                            ) : (
                              <span className="text-sm">{value}</span>
                            )
                          ) : (
                            <span className="text-sm">{value}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-3 text-center text-muted-foreground text-sm">-</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Selection Buttons Preview */}
        <div className="mb-6">
          <Label className="text-base font-semibold mb-3 block">Select your choice:</Label>
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: numOptions }, (_, i) => (
              <Button
                key={i}
                variant={selectedOption === i ? "default" : "outline"}
                className={`flex-1 min-w-[120px] ${selectedOption === i ? "gradient-primary" : ""}`}
                onClick={() => setSelectedOption(i)}
              >
                Option {String.fromCharCode(65 + i)}
              </Button>
            ))}
            <Button
              variant={selectedOption === numOptions ? "default" : "outline"}
              className={`flex-1 min-w-[120px] ${selectedOption === numOptions ? "gradient-primary" : ""}`}
              onClick={() => setSelectedOption(numOptions)}
            >
              None of these
            </Button>
          </div>
        </div>

        {/* Donation Input Preview */}
        <div className="border-t-2 border-border pt-6 mt-8">
          <div className="bg-muted/30 rounded-lg p-6">
            <Label className="text-base font-semibold mb-3 block">
              Instead of subscribing, I'd rather donate this amount
            </Label>
            <div className="flex gap-3 items-end">
              <div className="flex-1 max-w-xs">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input type="number" step="0.01" min="0" placeholder="0.00" className="pl-7" disabled />
                </div>
              </div>
              <Button variant="outline" disabled>
                Submit
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Submitting a donation suggestion will end the survey immediately
            </p>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <Button variant="outline" onClick={handlePrevious} disabled={currentTask === 0}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>

          <div className="flex gap-2">
            {tasks.map((_, idx) => (
              <div key={idx} className={`h-2 w-2 rounded-full ${idx === currentTask ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>

          <Button onClick={handleNext} disabled={currentTask === tasks.length - 1} className="gradient-primary">
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
};

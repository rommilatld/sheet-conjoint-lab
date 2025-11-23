import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChevronRight, ChevronLeft, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Attribute {
  name: string;
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
    const maxLevels = Math.max(...attributes.map(attr => attr.levels.length));
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
      low: Math.max(100, Math.min(low, 300))
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

  // Generate random alternatives for preview
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
      noneAlt[attr.name] = 'None of these';
    });
    alternatives.push(noneAlt);
    
    return alternatives;
  };

  // Generate 3 tasks with 3 alternatives each + None
  const tasks = Array.from({ length: 3 }, () => generateAlternatives(3));

  const currentAlternatives = tasks[currentTask];

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
                <div key={idx} className="inline-flex items-center gap-2 rounded-md bg-background px-3 py-1.5 text-sm border">
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
            <p className="text-xs text-muted-foreground">
              Recommended number of responses for statistical confidence
            </p>
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
            Calculated for {attributes.length} attributes with {attributes.reduce((sum, attr) => sum + attr.levels.length, 0)} total levels
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
          <p className="text-base font-medium text-foreground mb-4">
            {question || "Which subscription plan would you prefer?"}
          </p>
        </div>

        <RadioGroup
          value={selectedOption?.toString()}
          onValueChange={(val) => setSelectedOption(parseInt(val))}
          className="space-y-4"
        >
          {currentAlternatives.map((alternative, idx) => {
            const isNoneOption = Object.values(alternative).every(val => val === 'None of these');
            
            return (
              <div
                key={idx}
                className={`rounded-lg border-2 p-6 transition-all ${
                  selectedOption === idx ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                } ${isNoneOption ? 'bg-muted/30' : ''}`}
              >
                <div className="flex items-start gap-4">
                  <RadioGroupItem value={idx.toString()} id={`option-${idx}`} className="mt-1" />
                  <Label htmlFor={`option-${idx}`} className="flex-1 cursor-pointer">
                    {isNoneOption ? (
                      <div className="font-semibold text-lg text-muted-foreground">
                        None of these options
                      </div>
                    ) : (
                      <>
                        <div className="font-semibold mb-3 text-lg">Option {String.fromCharCode(65 + idx)}</div>
                        <div className="space-y-2">
                          {attributes.map((attr) => (
                            <div key={attr.name} className="flex items-center gap-2">
                              <span className="font-medium text-sm">{attr.name}:</span>
                              <span className="text-muted-foreground">{alternative[attr.name]}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </Label>
                </div>
              </div>
            );
          })}
        </RadioGroup>

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

          <Button
            onClick={handleNext}
            disabled={currentTask === tasks.length - 1 || selectedOption === null}
            className="gradient-primary"
          >
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
};

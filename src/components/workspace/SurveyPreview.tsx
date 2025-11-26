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

  // Convert a level into a colored UI element
  function renderColored(value: string) {
    if (!value) return <span />;

    const normalized = value.toLowerCase().trim();

    if (normalized === "included" || normalized === "✓") {
      return (
        <span className="flex items-center justify-center gap-1 text-green-600 font-semibold">
          <Check className="h-5 w-5 text-green-600" />
        </span>
      );
    }

    if (normalized === "not included" || normalized === "✕") {
      return (
        <span className="flex items-center justify-center gap-1 text-red-600 font-semibold">
          <X className="h-5 w-5 text-red-600" />
        </span>
      );
    }

    return <span className="text-sm">{value}</span>;
  }

  // Calculate recommended sample sizes
  const calculateSampleSizes = () => {
    const numAttributes = attributes.length;
    const maxLevels = Math.max(...attributes.map((attr) => attr.levels.length));
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
        if (data.introduction) setIntroduction(data.introduction);
        if (data.question) setQuestion(data.question);
      }
    } catch (error) {
      console.error("Failed to load config:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!introduction.trim()) {
      toast({ title: "Error", description: "Please enter an introduction", variant: "destructive" });
      return;
    }

    if (!question.trim()) {
      toast({ title: "Error", description: "Please enter a question", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("save-survey-config", {
        body: { projectKey, introduction: introduction.trim(), question: question.trim() },
      });

      if (error) throw new Error(error.message || "Failed to save configuration");

      toast({ title: "Saved!", description: "Survey configuration has been saved successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Generate preview tasks
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

      const noneAlt: Alternative = {};
      attributes.forEach((attr) => (noneAlt[attr.name] = "None of these"));
      alternatives.push(noneAlt);

      return alternatives;
    };

    return Array.from({ length: 3 }, () => generateAlternatives(3));
  });

  const currentAlternatives = tasks[currentTask];
  const numOptions = currentAlternatives.length - 1;

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
                placeholder="Write an introduction..."
                value={introduction}
                onChange={(e) => setIntroduction(e.target.value)}
                className="min-h-[150px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preview-question">Question</Label>
              <Input
                id="preview-question"
                placeholder="Which subscription plan would you prefer?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
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
                return (
                  <tr key={attrIdx} className={`border-b border-border ${attrIdx % 2 === 0 ? "bg-muted/20" : ""}`}>
                    <td className="p-3 font-medium">{attr.name}</td>
                    <td className="p-3 text-sm text-muted-foreground">{attr.description || ""}</td>

                    {currentAlternatives.slice(0, numOptions).map((alt, altIdx) => {
                      const value = alt[attr.name];
                      return (
                        <td key={altIdx} className="p-3 text-center">
                          {renderColored(value)}
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

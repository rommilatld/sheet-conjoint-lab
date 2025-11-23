import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Link2, Copy, Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SurveyTabProps {
  projectKey: string;
}

interface Survey {
  id: string;
  name: string;
  token: string;
  url: string;
  createdAt: string;
}

export const SurveyTab = ({ projectKey }: SurveyTabProps) => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(false);
  const [introduction, setIntroduction] = useState("");
  const [question, setQuestion] = useState("Which subscription plan would you prefer?");
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSurveys();
  }, [projectKey]);

  const loadSurveys = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-surveys', {
        body: { projectKey },
      });

      if (!error && data && data.surveys) {
        setSurveys(data.surveys);
      }
    } catch (error) {
      console.error("Failed to load surveys:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateSurveyLink = async () => {
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

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-survey-link', {
        body: { 
          projectKey,
          introduction: introduction.trim(),
          question: question.trim(),
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to generate survey link");
      }

      if (!data || !data.token) {
        throw new Error("No token received");
      }

      const surveyUrl = `${window.location.origin}/s/${data.token}`;
      
      const newSurvey: Survey = {
        id: data.surveyId,
        name: introduction.trim().substring(0, 50) + '...',
        token: data.token,
        url: surveyUrl,
        createdAt: new Date().toISOString(),
      };

      setSurveys([newSurvey, ...surveys]);
      setIntroduction("");
      setQuestion("Which subscription plan would you prefer?");

      toast({
        title: "Survey link generated!",
        description: "Copy and share the link with respondents",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (url: string, name: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "Copied!",
      description: `Survey link for "${name}" copied to clipboard`,
    });
  };

  if (loading) {
    return (
      <Card className="shadow-card p-8 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-card p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-2">Generate Survey Link</h2>
          <p className="text-muted-foreground">
            Create shareable links for respondents to take your survey
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="introduction">Introduction</Label>
            <Textarea
              id="introduction"
              placeholder="Write an introduction for your survey (2-3 paragraphs). This will be displayed at the top of the survey to provide context to respondents."
              value={introduction}
              onChange={(e) => setIntroduction(e.target.value)}
              className="min-h-[150px]"
            />
            <p className="text-xs text-muted-foreground">
              Provide context and instructions for survey respondents
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="question">Question</Label>
            <Input
              id="question"
              placeholder="Which subscription plan would you prefer?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && generateSurveyLink()}
            />
            <p className="text-xs text-muted-foreground">
              This question will appear for each choice task
            </p>
          </div>

          <Button
            onClick={generateSurveyLink}
            disabled={generating || !introduction.trim() || !question.trim()}
            className="w-full gradient-primary"
            size="lg"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Generate Link
              </>
            )}
          </Button>
        </div>
      </Card>

      {surveys.length > 0 && (
        <Card className="shadow-card p-6">
          <h3 className="text-xl font-semibold mb-4">Your Survey Links</h3>
          <div className="space-y-4">
            {surveys.map((survey) => (
              <div
                key={survey.id}
                className="rounded-lg border p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                      <h4 className="font-semibold">{survey.name}</h4>
                    </div>
                    <div className="rounded bg-muted p-2 font-mono text-sm break-all">
                      {survey.url}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Created {new Date(survey.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(survey.url, survey.name)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {surveys.length === 0 && (
        <Card className="shadow-card p-8">
          <div className="text-center py-8">
            <Link2 className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Survey Links Yet</h3>
            <p className="text-muted-foreground">
              Generate your first survey link to start collecting responses
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};

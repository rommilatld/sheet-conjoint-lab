import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link2, Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SurveyTabProps {
  projectKey: string;
}

interface Survey {
  id: string;
  url: string;
  createdAt: string;
  introduction: string;
  question: string;
}

export const SurveyTab = ({ projectKey }: SurveyTabProps) => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(false);
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
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-survey-link', {
        body: { 
          projectKey,
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
        url: surveyUrl,
        createdAt: new Date().toISOString(),
        introduction: data.introduction || "",
        question: data.question || "Which subscription plan would you prefer?",
      };

      setSurveys([newSurvey, ...surveys]);

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

  const copyToClipboard = (url: string, createdAt: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "Copied!",
      description: `Survey link from ${new Date(createdAt).toLocaleString()} copied to clipboard`,
    });
  };

  const deleteSurvey = async (surveyId: string, createdAt: string) => {
    try {
      const { error } = await supabase.functions.invoke('delete-survey', {
        body: { 
          projectKey,
          surveyId,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to delete survey");
      }

      setSurveys(surveys.filter(s => s.id !== surveyId));
      
      toast({
        title: "Deleted!",
        description: `Survey from ${new Date(createdAt).toLocaleString()} has been removed`,
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
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
            Create shareable links for respondents to take your survey. Configure survey text in the Preview tab.
          </p>
        </div>

        <Button
          onClick={generateSurveyLink}
          disabled={generating}
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
                      <h4 className="font-semibold">
                        {new Date(survey.createdAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </h4>
                    </div>
                    <div className="rounded bg-muted p-2 font-mono text-sm break-all mb-2">
                      {survey.url}
                    </div>
                    {survey.introduction && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {survey.introduction}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(survey.url, survey.createdAt)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteSurvey(survey.id, survey.createdAt)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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

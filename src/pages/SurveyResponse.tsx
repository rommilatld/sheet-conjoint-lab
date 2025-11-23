import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronRight, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Footer } from "@/components/Footer";

interface Alternative {
  [key: string]: string;
}

interface Task {
  taskId: number;
  alternatives: Alternative[];
}

const SurveyResponse = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [taskTransitioning, setTaskTransitioning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");
  
  const [surveyData, setSurveyData] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [introduction, setIntroduction] = useState("");
  const [question, setQuestion] = useState("");
  const [currentTask, setCurrentTask] = useState(0);
  const [responses, setResponses] = useState<{ [taskId: number]: number }>({});
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  useEffect(() => {
    loadSurvey();
  }, [token]);

  const loadSurvey = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('load-survey', {
        body: { surveyToken: token },
      });

      if (error) {
        throw new Error(error.message || "Failed to load survey");
      }

      if (!data || !data.tasks) {
        throw new Error("Invalid survey data");
      }

      console.log('Survey data loaded:', {
        hasIntroduction: !!data.introduction,
        introLength: data.introduction?.length || 0,
        hasQuestion: !!data.question,
        question: data.question,
      });

      setSurveyData(data);
      setTasks(data.tasks);
      setIntroduction(data.introduction || "");
      setQuestion(data.question || "Which subscription plan would you prefer?");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (selectedOption === null) return;

    // Save response
    setResponses({
      ...responses,
      [currentTask]: selectedOption,
    });

    if (currentTask < tasks.length - 1) {
      // Show loading animation
      setTaskTransitioning(true);
      setSelectedOption(null);
      
      // Wait 600ms before showing next task
      setTimeout(() => {
        setCurrentTask(currentTask + 1);
        setTaskTransitioning(false);
      }, 600);
    } else {
      submitSurvey();
    }
  };

  const submitSurvey = async () => {
    setSubmitting(true);
    try {
      // Include the last selected option
      const finalResponses = {
        ...responses,
        [currentTask]: selectedOption,
      };

      const { error } = await supabase.functions.invoke('submit-survey-response', {
        body: {
          surveyToken: token,
          responses: finalResponses,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to submit responses");
      }

      setCompleted(true);
      toast({
        title: "Thank you!",
        description: "Your responses have been recorded",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="container mx-auto max-w-2xl px-6 py-20">
          <Card className="p-8 text-center">
            <h2 className="mb-2 text-2xl font-bold text-destructive">Error</h2>
            <p className="text-muted-foreground">{error}</p>
            <Button
              onClick={() => navigate("/")}
              className="mt-6"
              variant="outline"
            >
              Return Home
            </Button>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="container mx-auto max-w-2xl px-6 py-20">
          <Card className="shadow-elegant p-8 text-center">
            <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-accent/20">
              <CheckCircle className="h-10 w-10 text-accent" />
            </div>
            <h1 className="mb-4 text-3xl font-bold">Thank You!</h1>
            <p className="mb-6 text-lg text-muted-foreground">
              Your responses have been recorded successfully.
            </p>
            <p className="text-muted-foreground">
              You can close this window now.
            </p>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  const currentTaskData = tasks[currentTask];
  const attributeNames = Object.keys(currentTaskData.alternatives[0]);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto max-w-4xl px-6 py-12">
        <div className="mb-8">
          <h1 className="mb-4 text-3xl font-bold">Research Survey</h1>
          {introduction && introduction.trim() && (
            <div className="mb-6 text-base text-muted-foreground whitespace-pre-line leading-relaxed">
              {introduction}
            </div>
          )}
        </div>

        <Card className="shadow-card p-8">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">
                Task {currentTask + 1} of {tasks.length}
              </h3>
              <div className="text-sm text-muted-foreground">
                {Math.round(((currentTask) / tasks.length) * 100)}% complete
              </div>
            </div>
            <p className="text-base font-medium text-foreground mb-4">
              {question || "Which subscription plan would you prefer?"}
            </p>
          </div>

          {taskTransitioning ? (
            <div className="space-y-4 animate-fade-in">
              {[0, 1].map((idx) => (
                <div
                  key={idx}
                  className="rounded-lg border-2 border-border p-6 animate-pulse"
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1 h-5 w-5 rounded-full bg-muted" />
                    <div className="flex-1">
                      <div className="h-6 w-24 bg-muted rounded mb-3" />
                      <div className="space-y-2">
                        <div className="h-4 w-3/4 bg-muted rounded" />
                        <div className="h-4 w-2/3 bg-muted rounded" />
                        <div className="h-4 w-5/6 bg-muted rounded" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="text-center text-sm text-muted-foreground py-4">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                Loading next question...
              </div>
            </div>
          ) : (
          <RadioGroup
            key={`task-${currentTask}`}
            value={selectedOption?.toString()}
            onValueChange={(val) => setSelectedOption(parseInt(val))}
            className="space-y-4 animate-fade-in"
          >
            {currentTaskData.alternatives.map((alternative, idx) => {
              const isNoneOption = Object.values(alternative).every(val => val === 'None of these');
              
              return (
                <div
                  key={idx}
                  className={`rounded-lg border-2 p-6 transition-all cursor-pointer animate-scale-in ${
                    selectedOption === idx
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  } ${isNoneOption ? 'bg-muted/30' : ''}`}
                  style={{ animationDelay: `${idx * 50}ms` }}
                  onClick={() => setSelectedOption(idx)}
                >
                  <div className="flex items-start gap-4">
                    <RadioGroupItem
                      value={idx.toString()}
                      id={`option-${idx}`}
                      className="mt-1"
                    />
                    <Label
                      htmlFor={`option-${idx}`}
                      className="flex-1 cursor-pointer"
                    >
                      {isNoneOption ? (
                        <div className="font-semibold text-lg text-muted-foreground">
                          None of these options
                        </div>
                      ) : (
                        <>
                          <div className="font-semibold mb-3 text-lg">
                            Option {String.fromCharCode(65 + idx)}
                          </div>
                          <div className="space-y-2">
                            {attributeNames.map((attr) => (
                              <div key={attr} className="flex items-center gap-2">
                                <span className="font-medium text-sm">{attr}:</span>
                                <span className="text-muted-foreground">
                                  {alternative[attr]}
                                </span>
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
          )}

          <div className="mt-8 flex items-center justify-between">
            <div className="flex gap-2">
              {tasks.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 w-2 rounded-full ${
                    idx < currentTask
                      ? "bg-accent"
                      : idx === currentTask
                      ? "bg-primary"
                      : "bg-muted"
                  }`}
                />
              ))}
            </div>

            <Button
              onClick={handleNext}
              disabled={selectedOption === null || submitting || taskTransitioning}
              className="gradient-primary"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Submitting...
                </>
              ) : currentTask === tasks.length - 1 ? (
                "Submit"
              ) : (
                <>
                  Next
                  <ChevronRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </div>
        </Card>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          Powered by{" "}
          <a
            href="https://experimentnation.com/consulting"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-medium"
          >
            Experiment Nation Consulting
          </a>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default SurveyResponse;

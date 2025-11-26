import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronRight, CheckCircle, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Footer } from "@/components/Footer";

interface Attribute {
  name: string;
  description?: string;
  type?: "standard" | "included-not-included";
  [key: string]: any;
}

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
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [introduction, setIntroduction] = useState("");
  const [question, setQuestion] = useState("");
  const [currentTask, setCurrentTask] = useState(0);
  const [responses, setResponses] = useState<{ [taskId: number]: number }>({});
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [donationAmount, setDonationAmount] = useState("");

  useEffect(() => {
    loadSurvey();
  }, [token]);

  const loadSurvey = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("load-survey", {
        body: { surveyToken: token },
      });

      if (error) {
        throw new Error(error.message || "Failed to load survey");
      }

      if (!data || !data.tasks) {
        throw new Error("Invalid survey data");
      }

      console.log("Survey data loaded:", {
        hasIntroduction: !!data.introduction,
        introLength: data.introduction?.length || 0,
        hasQuestion: !!data.question,
        question: data.question,
        attributes: data.attributes,
      });

      setSurveyData(data);
      setTasks(data.tasks);
      setAttributes(data.attributes || []);
      setIntroduction(data.introduction || "");
      setQuestion(data.question || "Which subscription plan would you prefer?");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDonationSubmit = async () => {
    const amount = parseFloat(donationAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid donation amount",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("submit-survey-response", {
        body: {
          surveyToken: token,
          type: "donation",
          donationAmount: amount,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to submit donation");
      }

      setCompleted(true);
      toast({
        title: "Thank you!",
        description: "Your donation preference has been recorded",
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

      const { error } = await supabase.functions.invoke("submit-survey-response", {
        body: {
          surveyToken: token,
          type: "survey",
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
            <Button onClick={() => navigate("/")} className="mt-6" variant="outline">
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
            <p className="mb-6 text-lg text-muted-foreground">Your response has been recorded successfully.</p>
            <p className="text-muted-foreground">You can close this window now.</p>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  const currentTaskData = tasks[currentTask];
  const numOptions = currentTaskData.alternatives.filter(
    (alt) => !Object.values(alt).every((val) => val === "None of these"),
  ).length;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto max-w-6xl px-6 py-12">
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
                {Math.round((currentTask / tasks.length) * 100)}% complete
              </div>
            </div>
            <p className="text-base font-medium text-foreground mb-6">
              {question || "Which subscription plan would you prefer?"}
            </p>
          </div>

          {taskTransitioning ? (
            <div className="space-y-4 animate-fade-in">
              <div className="rounded-lg border p-4 animate-pulse">
                <div className="h-48 bg-muted rounded" />
              </div>
              <div className="text-center text-sm text-muted-foreground py-4">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                Loading next question...
              </div>
            </div>
          ) : (
            <>
              {/* Table Layout */}
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
                        <tr
                          key={attrIdx}
                          className={`border-b border-border ${attrIdx % 2 === 0 ? "bg-muted/20" : ""}`}
                        >
                          <td className="p-3 font-medium">{attr.name}</td>
                          <td className="p-3 text-sm text-muted-foreground">{attr.description || ""}</td>
                          {currentTaskData.alternatives.slice(0, numOptions).map((alt, altIdx) => {
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

              {/* Selection Buttons */}
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

              {/* Donation Input */}
              <div className="border-t-2 border-border pt-6 mt-8">
                <div className="bg-muted/30 rounded-lg p-6">
                  <Label htmlFor="donation" className="text-base font-semibold mb-3 block">
                    Instead of subscribing, I'd rather donate this amount
                  </Label>
                  <div className="flex gap-3 items-end">
                    <div className="flex-1 max-w-xs">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input
                          id="donation"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={donationAmount}
                          onChange={(e) => setDonationAmount(e.target.value)}
                          className="pl-7"
                        />
                      </div>
                    </div>
                    <Button onClick={handleDonationSubmit} disabled={!donationAmount || submitting} variant="outline">
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        "Submit"
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Submitting a donation will end the survey immediately
                  </p>
                </div>
              </div>
            </>
          )}

          <div className="mt-8 flex items-center justify-between">
            <div className="flex gap-2">
              {tasks.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 w-2 rounded-full ${
                    idx < currentTask ? "bg-accent" : idx === currentTask ? "bg-primary" : "bg-muted"
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

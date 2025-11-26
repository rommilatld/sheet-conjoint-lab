import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Footer } from "@/components/Footer";

const OpenProject = () => {
  const [projectKey, setProjectKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      // Extract project key from file (assumes key is the content or on a specific line)
      const key = text.trim();
      setProjectKey(key);
      setError("");
    } catch (err: any) {
      setError("Failed to read file");
    }
  };

  const handleOpenProject = async () => {
    setError("");
    setLoading(true);

    try {
      if (!projectKey.trim()) {
        throw new Error("Please enter a project key");
      }

      // Validate project key by attempting to decrypt
      const { data, error: functionError } = await supabase.functions.invoke('validate-key', {
        body: { projectKey },
      });

      if (functionError || !data || !data.valid) {
        throw new Error("Invalid project key");
      }

      // Navigate to workspace
      navigate(`/workspace/${projectKey}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto max-w-2xl px-6 py-20">
        <div className="mb-8 text-center">
          <h1 className="mb-3 text-4xl font-bold">Open Existing Project</h1>
          <p className="text-lg text-muted-foreground">
            Enter your project key to continue
          </p>
        </div>

        <Card className="shadow-card p-8">
          <div className="space-y-6">
            <div>
              <Label htmlFor="projectKey" className="text-base">Project Key</Label>
              <Input
                id="projectKey"
                type="text"
                placeholder="Enter your project key..."
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value)}
                className="mt-2 font-mono"
                onKeyPress={(e) => e.key === "Enter" && handleOpenProject()}
              />
              <p className="mt-2 text-sm text-muted-foreground">
                This is the key you saved when creating your project
              </p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <div>
              <Label htmlFor="fileUpload" className="text-base">Upload Project File</Label>
              <Input
                id="fileUpload"
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
                className="mt-2"
              />
              <p className="mt-2 text-sm text-muted-foreground">
                Upload a .txt file containing your project key
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => navigate("/")}
                size="lg"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleOpenProject}
                disabled={!projectKey || loading}
                className="flex-1 gradient-primary"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Opening...
                  </>
                ) : (
                  "Open Project"
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default OpenProject;

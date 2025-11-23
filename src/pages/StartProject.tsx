import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, Copy, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const StartProject = () => {
  const [sheetUrl, setSheetUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [projectKey, setProjectKey] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const serviceAccountEmail = "your-service-account@project.iam.gserviceaccount.com";

  const handleCreateProject = async () => {
    setError("");
    setLoading(true);

    try {
      // Extract sheet ID from URL
      const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        throw new Error("Invalid Google Sheet URL");
      }
      const sheetId = match[1];

      // Call edge function to initialize project
      const { data, error: functionError } = await supabase.functions.invoke('init-project', {
        body: { sheetId },
      });

      if (functionError) {
        throw new Error(functionError.message || "Failed to initialize project");
      }

      if (!data || !data.projectKey) {
        throw new Error("Failed to generate project key");
      }

      setProjectKey(data.projectKey);
      
      toast({
        title: "Project created!",
        description: "Save your project key to access this project later.",
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(projectKey);
    toast({
      title: "Copied!",
      description: "Project key copied to clipboard",
    });
  };

  const downloadKey = () => {
    const blob = new Blob([projectKey], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "conjoint-project-key.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Downloaded!",
      description: "Project key saved to your downloads",
    });
  };

  const openWorkspace = () => {
    navigate(`/workspace/${projectKey}`);
  };

  if (projectKey) {
    return (
      <div className="container mx-auto max-w-2xl px-6 py-20">
        <Card className="shadow-elegant p-8">
          <div className="mb-6 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent/20">
              <CheckCircle className="h-8 w-8 text-accent" />
            </div>
            <h1 className="mb-2 text-3xl font-bold">Project Created!</h1>
            <p className="text-muted-foreground">
              Save your project key to access this project anytime
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-base font-semibold">Your Project Key</Label>
              <div className="mt-2 flex gap-2">
                <Input
                  value={projectKey}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button variant="outline" size="icon" onClick={copyToClipboard}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={downloadKey}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Alert className="bg-accent/10 border-accent">
              <AlertDescription>
                <strong>Important:</strong> Store this key safely. You'll need it to access your project.
                Without it, you won't be able to open your project again.
              </AlertDescription>
            </Alert>

            <Button onClick={openWorkspace} className="w-full gradient-primary" size="lg">
              Open Workspace
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-6 py-20">
      <div className="mb-8 text-center">
        <h1 className="mb-3 text-4xl font-bold">Start New Project</h1>
        <p className="text-lg text-muted-foreground">
          Connect your Google Sheet to begin
        </p>
      </div>

      <Card className="shadow-card p-8">
        <div className="space-y-6">
          {/* Instructions */}
          <div className="rounded-lg bg-muted/50 p-6">
            <h2 className="mb-3 text-lg font-semibold">Setup Instructions</h2>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li>1. Create a new Google Sheet or use an existing one</li>
              <li>2. Share the sheet with: <code className="rounded bg-muted px-1 py-0.5 text-xs">{serviceAccountEmail}</code></li>
              <li>3. Give it <strong>Editor</strong> permissions</li>
              <li>4. Paste the sheet URL below</li>
            </ol>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="sheetUrl">Google Sheet URL</Label>
              <Input
                id="sheetUrl"
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                className="mt-2"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleCreateProject}
              disabled={!sheetUrl || loading}
              className="w-full gradient-primary"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating Project...
                </>
              ) : (
                "Create Project"
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default StartProject;

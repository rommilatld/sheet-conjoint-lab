import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { ProjectInfo } from "@/components/workspace/ProjectInfo";
import { AttributesTab } from "@/components/workspace/AttributesTab";
import { DesignTab } from "@/components/workspace/DesignTab";
import { SurveyTab } from "@/components/workspace/SurveyTab";

const Workspace = () => {
  const { projectKey } = useParams();
  const [loading, setLoading] = useState(true);
  const [sheetUrl, setSheetUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProject = async () => {
      try {
        const response = await fetch("/api/get-sheet-info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectKey }),
        });

        if (!response.ok) {
          throw new Error("Failed to load project");
        }

        const data = await response.json();
        setSheetUrl(data.sheetUrl);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectKey]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-2xl px-6 py-20">
        <Card className="p-8 text-center">
          <h2 className="mb-2 text-2xl font-bold text-destructive">Error</h2>
          <p className="text-muted-foreground">{error}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Project Workspace</h1>
        <p className="text-muted-foreground">Manage your conjoint study</p>
      </div>

      <Tabs defaultValue="info" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="info">Project Info</TabsTrigger>
          <TabsTrigger value="attributes">Attributes</TabsTrigger>
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="survey">Survey</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <ProjectInfo projectKey={projectKey!} sheetUrl={sheetUrl} />
        </TabsContent>

        <TabsContent value="attributes">
          <AttributesTab projectKey={projectKey!} />
        </TabsContent>

        <TabsContent value="design">
          <DesignTab projectKey={projectKey!} />
        </TabsContent>

        <TabsContent value="survey">
          <SurveyTab projectKey={projectKey!} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Workspace;

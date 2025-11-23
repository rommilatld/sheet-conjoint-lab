import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { ProjectInfo } from "@/components/workspace/ProjectInfo";
import { AttributesTab } from "@/components/workspace/AttributesTab";
import { DesignTab } from "@/components/workspace/DesignTab";
import { SurveyTab } from "@/components/workspace/SurveyTab";
import { AnalysisTab } from "@/components/workspace/AnalysisTab";
import { supabase } from "@/integrations/supabase/client";
import enLogo from "@/assets/en-logo.jpg";
import { Footer } from "@/components/Footer";
const Workspace = () => {
  const {
    projectKey
  } = useParams();
  const [loading, setLoading] = useState(true);
  const [sheetUrl, setSheetUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const loadProject = async () => {
      try {
        const {
          data,
          error: functionError
        } = await supabase.functions.invoke('get-sheet-info', {
          body: {
            projectKey
          }
        });
        if (functionError) {
          throw new Error("Failed to load project");
        }
        if (!data || !data.sheetUrl) {
          throw new Error("Invalid project data");
        }
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
    return <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>;
  }
  if (error) {
    return <div className="container mx-auto max-w-2xl px-6 py-20">
        <Card className="p-8 text-center">
          <h2 className="mb-2 text-2xl font-bold text-destructive">Error</h2>
          <p className="text-muted-foreground">{error}</p>
        </Card>
      </div>;
  }
  return <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={enLogo} alt="Experiment Nation" className="h-10 w-10" />
            <h1 className="text-2xl font-bold">Plan Builder by Experiment Nation</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 flex-1">
        

      <Tabs defaultValue="info" className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="info">Project Info</TabsTrigger>
            <TabsTrigger value="attributes">Attributes</TabsTrigger>
            <TabsTrigger value="design">Preview</TabsTrigger>
            <TabsTrigger value="survey">Generate Links</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
          </TabsList>
          <Button variant="outline" onClick={() => window.location.href = '/'} className="whitespace-nowrap">
            Start New Survey
          </Button>
        </div>

        <TabsContent value="info">
          <ProjectInfo projectKey={projectKey!} sheetUrl={sheetUrl} onNavigate={(tab) => {
            const tabElement = document.querySelector(`[data-state="active"][value="${tab}"]`);
            if (tabElement) {
              (tabElement as HTMLElement).click();
            }
          }} />
        </TabsContent>

        <TabsContent value="attributes">
          <AttributesTab projectKey={projectKey!} onNavigate={(tab) => {
            const tabElement = document.querySelector(`[value="${tab}"]`);
            if (tabElement) {
              (tabElement as HTMLElement).click();
            }
          }} />
        </TabsContent>

        <TabsContent value="design">
          <DesignTab projectKey={projectKey!} onNavigate={(tab) => {
            const tabElement = document.querySelector(`[value="${tab}"]`);
            if (tabElement) {
              (tabElement as HTMLElement).click();
            }
          }} />
        </TabsContent>

        <TabsContent value="survey">
          <SurveyTab projectKey={projectKey!} onNavigate={(tab) => {
            const tabElement = document.querySelector(`[value="${tab}"]`);
            if (tabElement) {
              (tabElement as HTMLElement).click();
            }
          }} />
        </TabsContent>

        <TabsContent value="analysis">
          <AnalysisTab projectKey={projectKey!} />
        </TabsContent>
      </Tabs>
      </div>

      <Footer />
    </div>;
};
export default Workspace;
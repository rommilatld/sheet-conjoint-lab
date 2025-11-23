import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SurveyPreview } from "./SurveyPreview";

interface DesignTabProps {
  projectKey: string;
}

interface Attribute {
  name: string;
  levels: string[];
}

export const DesignTab = ({ projectKey }: DesignTabProps) => {
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadAttributes();
  }, [projectKey]);

  const loadAttributes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-attributes', {
        body: { projectKey },
      });

      if (!error && data && data.attributes) {
        setAttributes(data.attributes);
        if (data.attributes.length > 0) {
          setShowPreview(true);
        }
      }
    } catch (error) {
      console.error("Failed to load attributes:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-card p-8 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
      </Card>
    );
  }

  if (attributes.length === 0) {
    return (
      <Card className="shadow-card p-8">
        <div className="text-center py-12">
          <Eye className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-semibold mb-2">No Attributes Yet</h2>
          <p className="text-muted-foreground mb-6">
            Add attributes in the Attributes tab to see a survey preview here
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold">Survey Preview</h2>
            <p className="text-muted-foreground">
              See how your survey will look to respondents
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye className="mr-2 h-4 w-4" />
            {showPreview ? "Hide" : "Show"} Preview
          </Button>
        </div>

        <div className="rounded-lg bg-muted/50 p-6">
          <h3 className="mb-3 text-lg font-semibold">Attributes in Survey</h3>
          <ul className="space-y-2 text-sm">
            {attributes.map((attr, idx) => (
              <li key={idx} className="flex items-start">
                <span className="font-medium mr-2">{attr.name}:</span>
                <span className="text-muted-foreground">
                  {attr.levels.join(", ")} ({attr.levels.length} levels)
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {showPreview && <SurveyPreview attributes={attributes} projectKey={projectKey} />}
    </div>
  );
};

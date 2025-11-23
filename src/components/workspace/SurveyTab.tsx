import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link2 } from "lucide-react";

interface SurveyTabProps {
  projectKey: string;
}

export const SurveyTab = ({ projectKey }: SurveyTabProps) => {
  return (
    <Card className="shadow-card p-8">
      <div className="text-center py-12">
        <Link2 className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Survey Links</h2>
        <p className="text-muted-foreground mb-6">
          Generate and manage respondent survey links
        </p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Once you've designed your survey, you'll be able to generate secure,
          shareable links for respondents here.
        </p>
      </div>
    </Card>
  );
};

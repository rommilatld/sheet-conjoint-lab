import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Construction } from "lucide-react";

interface DesignTabProps {
  projectKey: string;
}

export const DesignTab = ({ projectKey }: DesignTabProps) => {
  return (
    <Card className="shadow-card p-8">
      <div className="text-center py-12">
        <Construction className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Survey Design</h2>
        <p className="text-muted-foreground mb-6">
          Fractional factorial design generation coming soon
        </p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          This feature will allow you to generate optimal experimental designs,
          specify the number of tasks and alternatives, and create survey configurations.
        </p>
      </div>
    </Card>
  );
};

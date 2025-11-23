import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProjectInfoProps {
  projectKey: string;
  sheetUrl: string;
}

export const ProjectInfo = ({ projectKey, sheetUrl }: ProjectInfoProps) => {
  const { toast } = useToast();

  const copyKey = () => {
    navigator.clipboard.writeText(projectKey);
    toast({
      title: "Copied!",
      description: "Project key copied to clipboard",
    });
  };

  return (
    <Card className="shadow-card p-8">
      <div className="space-y-6">
        <div>
          <h2 className="mb-4 text-2xl font-semibold">Project Information</h2>
          <p className="text-muted-foreground">
            Your project details and access information
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-base">Project Key</Label>
            <div className="mt-2 flex gap-2">
              <Input value={projectKey} readOnly className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={copyKey}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Save this key to access your project anytime
            </p>
          </div>

          <div>
            <Label className="text-base">Google Sheet</Label>
            <div className="mt-2 flex gap-2">
              <Input value={sheetUrl} readOnly className="text-sm" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => window.open(sheetUrl, "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              All your project data is stored here
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-muted/50 p-6">
          <h3 className="mb-3 text-lg font-semibold">How it works</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• All data is stored in your Google Sheet</li>
            <li>• Your project key encrypts the sheet ID for security</li>
            <li>• No data is stored in our database</li>
            <li>• You have complete control over your data</li>
          </ul>
        </div>
      </div>
    </Card>
  );
};

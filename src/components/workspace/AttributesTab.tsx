import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AttributesTabProps {
  projectKey: string;
}

interface Attribute {
  name: string;
  levels: string[];
}

export const AttributesTab = ({ projectKey }: AttributesTabProps) => {
  const [attributes, setAttributes] = useState<Attribute[]>([
    { name: "", levels: ["", ""] },
  ]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadAttributes();
  }, [projectKey]);

  const loadAttributes = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/get-attributes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectKey }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.attributes && data.attributes.length > 0) {
          setAttributes(data.attributes);
        }
      }
    } catch (error) {
      console.error("Failed to load attributes:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveAttributes = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/save-attributes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectKey, attributes }),
      });

      if (!response.ok) {
        throw new Error("Failed to save attributes");
      }

      toast({
        title: "Saved!",
        description: "Attributes saved to your Google Sheet",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addAttribute = () => {
    setAttributes([...attributes, { name: "", levels: ["", ""] }]);
  };

  const removeAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  const updateAttributeName = (index: number, name: string) => {
    const updated = [...attributes];
    updated[index].name = name;
    setAttributes(updated);
  };

  const updateLevel = (attrIndex: number, levelIndex: number, value: string) => {
    const updated = [...attributes];
    updated[attrIndex].levels[levelIndex] = value;
    setAttributes(updated);
  };

  const addLevel = (attrIndex: number) => {
    const updated = [...attributes];
    updated[attrIndex].levels.push("");
    setAttributes(updated);
  };

  const removeLevel = (attrIndex: number, levelIndex: number) => {
    const updated = [...attributes];
    if (updated[attrIndex].levels.length > 2) {
      updated[attrIndex].levels = updated[attrIndex].levels.filter(
        (_, i) => i !== levelIndex
      );
      setAttributes(updated);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-card p-8 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
      </Card>
    );
  }

  return (
    <Card className="shadow-card p-8">
      <div className="space-y-6">
        <div>
          <h2 className="mb-2 text-2xl font-semibold">Attributes & Levels</h2>
          <p className="text-muted-foreground">
            Define the features and options for your conjoint study
          </p>
        </div>

        <div className="space-y-6">
          {attributes.map((attr, attrIndex) => (
            <div key={attrIndex} className="rounded-lg border p-6">
              <div className="mb-4 flex items-center justify-between">
                <Label className="text-base">Attribute {attrIndex + 1}</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAttribute(attrIndex)}
                  disabled={attributes.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <Input
                  placeholder="e.g., Price, Storage, Speed"
                  value={attr.name}
                  onChange={(e) => updateAttributeName(attrIndex, e.target.value)}
                />

                <div className="space-y-2">
                  <Label className="text-sm">Levels</Label>
                  {attr.levels.map((level, levelIndex) => (
                    <div key={levelIndex} className="flex gap-2">
                      <Input
                        placeholder={`Level ${levelIndex + 1}`}
                        value={level}
                        onChange={(e) =>
                          updateLevel(attrIndex, levelIndex, e.target.value)
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLevel(attrIndex, levelIndex)}
                        disabled={attr.levels.length <= 2}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addLevel(attrIndex)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Level
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={addAttribute}>
            <Plus className="mr-2 h-4 w-4" />
            Add Attribute
          </Button>
          <Button
            onClick={saveAttributes}
            disabled={saving}
            className="gradient-primary"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Attributes"
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};

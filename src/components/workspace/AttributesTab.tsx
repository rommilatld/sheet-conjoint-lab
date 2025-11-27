import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { TabNavigation } from "./TabNavigation";
interface AttributesTabProps {
  projectKey: string;
  onNavigate?: (tab: string) => void;
}
interface Attribute {
  name: string;
  description?: string;
  type?: "standard" | "included-not-included";
  levels: string[];
  isPriceAttribute?: boolean;
  currency?: string;
}
export const AttributesTab = ({ projectKey, onNavigate }: AttributesTabProps) => {
  const [attributes, setAttributes] = useState<Attribute[]>([
    {
      name: "Pricing",
      description: "",
      type: "standard",
      levels: ["", ""],
    },
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
      const { data, error } = await supabase.functions.invoke("get-attributes", {
        body: {
          projectKey,
        },
      });
      if (!error && data && data.attributes && data.attributes.length > 0) {
        setAttributes(data.attributes);
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
      const { error } = await supabase.functions.invoke("save-attributes", {
        body: {
          projectKey,
          attributes,
        },
      });
      if (error) {
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
    setAttributes([
      ...attributes,
      {
        name: "",
        description: "",
        type: "standard",
        levels: ["", ""],
        isPriceAttribute: false,
        currency: "USD",
      },
    ]);
  };

  const updateAttributeDescription = (index: number, description: string) => {
    const updated = [...attributes];
    updated[index].description = description;
    setAttributes(updated);
  };

  const updateAttributeType = (index: number, type: "standard" | "included-not-included") => {
    const updated = [...attributes];
    updated[index].type = type;
    
    // If switching to included/not-included, auto-populate levels
    if (type === "included-not-included") {
      updated[index].levels = ["Not Included", "Included"];
    } else if (updated[index].levels.length === 2 && 
               updated[index].levels[0] === "Not Included" && 
               updated[index].levels[1] === "Included") {
      // If switching away from included/not-included, reset to empty levels
      updated[index].levels = ["", ""];
    }
    
    setAttributes(updated);
  };
  const togglePriceAttribute = (index: number, checked: boolean) => {
    const updated = [...attributes];
    // If marking as price attribute, unmark all others
    if (checked) {
      updated.forEach((attr, i) => {
        attr.isPriceAttribute = i === index;
      });
    } else {
      updated[index].isPriceAttribute = false;
    }
    setAttributes(updated);
  };
  const updateCurrency = (index: number, currency: string) => {
    const updated = [...attributes];
    updated[index].currency = currency;
    setAttributes(updated);
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
      updated[attrIndex].levels = updated[attrIndex].levels.filter((_, i) => i !== levelIndex);
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
          <p className="text-sm text-muted-foreground">
            Define the features and options for your conjoint study. Each attribute should have at least 2 levels. Use
            “included” and “not included” as the levels for attributes without quantities, and/or explicitly list what’s
            included when different items vary by tier.
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
                <div>
                  <Label htmlFor={`attr-name-${attrIndex}`}>Attribute Name</Label>
                  <Input
                    id={`attr-name-${attrIndex}`}
                    placeholder="e.g., Pricing, Storage, Speed"
                    value={attr.name}
                    onChange={(e) => updateAttributeName(attrIndex, e.target.value)}
                    className="mt-1.5"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Enter a descriptive name for this feature</p>
                </div>

                <div>
                  <Label htmlFor={`attr-desc-${attrIndex}`}>Description (Optional)</Label>
                  <Textarea
                    id={`attr-desc-${attrIndex}`}
                    placeholder="e.g., Additional context about this feature"
                    value={attr.description || ""}
                    onChange={(e) => updateAttributeDescription(attrIndex, e.target.value)}
                    className="mt-1.5 min-h-[60px]"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">This will appear in the survey table</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`price-${attrIndex}`}
                        checked={attr.isPriceAttribute || false}
                        onCheckedChange={(checked) => togglePriceAttribute(attrIndex, checked as boolean)}
                      />
                      <Label htmlFor={`price-${attrIndex}`} className="text-sm font-medium cursor-pointer">
                        Price Attribute
                      </Label>
                    </div>
                    {attr.isPriceAttribute && (
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`currency-${attrIndex}`} className="text-sm">
                          Currency:
                        </Label>
                        <Select
                          value={attr.currency || "USD"}
                          onValueChange={(value) => updateCurrency(attrIndex, value)}
                        >
                          <SelectTrigger id={`currency-${attrIndex}`} className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                            <SelectItem value="JPY">JPY</SelectItem>
                            <SelectItem value="CAD">CAD</SelectItem>
                            <SelectItem value="AUD">AUD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-muted/30">
                    <Label className="text-sm mb-2 block">Attribute Type</Label>
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id={`type-standard-${attrIndex}`}
                          name={`type-${attrIndex}`}
                          checked={attr.type === "standard" || !attr.type}
                          onChange={() => updateAttributeType(attrIndex, "standard")}
                          className="cursor-pointer"
                        />
                        <Label htmlFor={`type-standard-${attrIndex}`} className="text-sm cursor-pointer">
                          Standard
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id={`type-included-${attrIndex}`}
                          name={`type-${attrIndex}`}
                          checked={attr.type === "included-not-included"}
                          onChange={() => updateAttributeType(attrIndex, "included-not-included")}
                          className="cursor-pointer"
                        />
                        <Label htmlFor={`type-included-${attrIndex}`} className="text-sm cursor-pointer">
                          Included/Not-Included
                        </Label>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {attr.type === "included-not-included" 
                        ? "Levels auto-set to checkmarks" 
                        : "Customize your own levels"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Levels</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    {attr.type === "included-not-included" 
                      ? "Levels automatically set for Included/Not-Included attributes"
                      : "Define the different options for this attribute (minimum 2)"}
                  </p>
                  {attr.levels.map((level, levelIndex) => (
                    <div key={levelIndex} className="flex gap-2">
                      <Input
                        placeholder={attr.isPriceAttribute ? "e.g., 9.99" : `Level ${levelIndex + 1}`}
                        value={level}
                        disabled={attr.type === "included-not-included"}
                        onChange={(e) => {
                          const value = e.target.value;
                          // If price attribute, only allow numbers and one decimal point with max 2 decimals
                          if (attr.isPriceAttribute) {
                            if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
                              updateLevel(attrIndex, levelIndex, value);
                            }
                          } else {
                            updateLevel(attrIndex, levelIndex, value);
                          }
                        }}
                        onBlur={(e) => {
                          // Validate on blur for price attributes
                          if (attr.isPriceAttribute && e.target.value.trim()) {
                            const numValue = parseFloat(e.target.value);
                            if (isNaN(numValue)) {
                              toast({
                                title: "Invalid Price",
                                description: "Price levels must be numerical values only",
                                variant: "destructive",
                              });
                              updateLevel(attrIndex, levelIndex, "");
                            }
                          }
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLevel(attrIndex, levelIndex)}
                        disabled={attr.levels.length <= 2 || attr.type === "included-not-included"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {attr.type !== "included-not-included" && (
                    <Button variant="outline" size="sm" onClick={() => addLevel(attrIndex)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Level
                    </Button>
                  )}
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
          <Button onClick={saveAttributes} disabled={saving} className="gradient-primary">
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

        <TabNavigation
          onPrevious={() => onNavigate?.("info")}
          onNext={() => onNavigate?.("design")}
          previousLabel="Project Info"
          nextLabel="Preview"
        />
      </div>
    </Card>
  );
};

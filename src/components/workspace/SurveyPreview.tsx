import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ChevronRight, ChevronLeft } from "lucide-react";

interface Attribute {
  name: string;
  levels: string[];
}

interface SurveyPreviewProps {
  attributes: Attribute[];
}

interface Alternative {
  [key: string]: string;
}

export const SurveyPreview = ({ attributes }: SurveyPreviewProps) => {
  const [currentTask, setCurrentTask] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  // Generate random alternatives for preview
  const generateAlternatives = (count: number): Alternative[] => {
    return Array.from({ length: count }, () => {
      const alt: Alternative = {};
      attributes.forEach((attr) => {
        const randomLevel = attr.levels[Math.floor(Math.random() * attr.levels.length)];
        alt[attr.name] = randomLevel;
      });
      return alt;
    });
  };

  // Generate 3 tasks with 3 alternatives each
  const tasks = Array.from({ length: 3 }, () => generateAlternatives(3));

  const currentAlternatives = tasks[currentTask];

  const handleNext = () => {
    if (currentTask < tasks.length - 1) {
      setCurrentTask(currentTask + 1);
      setSelectedOption(null);
    }
  };

  const handlePrevious = () => {
    if (currentTask > 0) {
      setCurrentTask(currentTask - 1);
      setSelectedOption(null);
    }
  };

  return (
    <Card className="shadow-card p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">
            Task {currentTask + 1} of {tasks.length}
          </h3>
          <div className="text-sm text-muted-foreground">
            Preview Mode
          </div>
        </div>
        <p className="text-muted-foreground">
          Which subscription plan would you prefer?
        </p>
      </div>

      <RadioGroup
        value={selectedOption?.toString()}
        onValueChange={(val) => setSelectedOption(parseInt(val))}
        className="space-y-4"
      >
        {currentAlternatives.map((alternative, idx) => (
          <div
            key={idx}
            className={`rounded-lg border-2 p-6 transition-all ${
              selectedOption === idx
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            <div className="flex items-start gap-4">
              <RadioGroupItem
                value={idx.toString()}
                id={`option-${idx}`}
                className="mt-1"
              />
              <Label
                htmlFor={`option-${idx}`}
                className="flex-1 cursor-pointer"
              >
                <div className="font-semibold mb-3 text-lg">
                  Option {String.fromCharCode(65 + idx)}
                </div>
                <div className="space-y-2">
                  {attributes.map((attr) => (
                    <div key={attr.name} className="flex items-center gap-2">
                      <span className="font-medium text-sm">{attr.name}:</span>
                      <span className="text-muted-foreground">
                        {alternative[attr.name]}
                      </span>
                    </div>
                  ))}
                </div>
              </Label>
            </div>
          </div>
        ))}
      </RadioGroup>

      <div className="mt-8 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentTask === 0}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>

        <div className="flex gap-2">
          {tasks.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 w-2 rounded-full ${
                idx === currentTask ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <Button
          onClick={handleNext}
          disabled={currentTask === tasks.length - 1 || selectedOption === null}
          className="gradient-primary"
        >
          Next
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};

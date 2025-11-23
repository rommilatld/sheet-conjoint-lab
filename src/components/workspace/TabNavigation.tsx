import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface TabNavigationProps {
  onPrevious?: () => void;
  onNext?: () => void;
  previousLabel?: string;
  nextLabel?: string;
}

export const TabNavigation = ({
  onPrevious,
  onNext,
  previousLabel = "Previous",
  nextLabel = "Next",
}: TabNavigationProps) => {
  return (
    <div className="flex items-center justify-between pt-6 border-t mt-8">
      <div>
        {onPrevious && (
          <Button variant="outline" onClick={onPrevious}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            {previousLabel}
          </Button>
        )}
      </div>
      <div>
        {onNext && (
          <Button onClick={onNext} className="gradient-primary">
            {nextLabel}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

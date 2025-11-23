import { Link } from "react-router-dom";

export const Footer = () => {
  return (
    <footer className="border-t bg-card mt-auto">
      <div className="container mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Experiment Nation. All rights reserved.
          </div>
          <div className="flex gap-6">
            <a
              href="https://experimentnation.com/consulting"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Consulting
            </a>
            <a
              href="https://experimentnation.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              About Us
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

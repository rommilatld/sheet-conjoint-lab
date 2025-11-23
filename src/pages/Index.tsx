import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Lock, Zap, BarChart3, Users } from "lucide-react";
import { Link } from "react-router-dom";
import enLogo from "@/assets/en-logo.jpg";
const Index = () => {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={enLogo} alt="Experiment Nation" className="h-10 w-10" />
            <h1 className="text-2xl font-bold">Plan Builder by Experiment Nation</h1>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute inset-0 gradient-subtle opacity-60" />
        <div className="container relative mx-auto px-6">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="mb-6 text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl">
              Subscription Plans,
              <br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Simplified</span>
            </h1>
            <p className="mb-10 text-xl text-muted-foreground md:text-2xl">
              Build, distribute, and analyze conjoint studies for subscription plans. Your data stays in your Google
              Sheet—no database, maximum control.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Link to="/start">
                <Button size="lg" className="gradient-primary text-lg shadow-elegant transition-smooth hover:scale-105">
                  Start New Project
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/open">
                <Button size="lg" variant="outline" className="text-lg transition-smooth hover:scale-105">
                  Open Existing Project
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              Everything you need designing your subscription plans
            </h2>
            <p className="text-lg text-muted-foreground">Professional tools powered by Google Sheets</p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-card transition-smooth hover:shadow-elegant p-8">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl gradient-primary">
                <Lock className="h-7 w-7 text-white" />
              </div>
              <h3 className="mb-3 text-xl font-semibold">Secure & Private</h3>
              <p className="text-muted-foreground">Your data never leaves your Google Sheet.  </p>
            </Card>

            <Card className="shadow-card transition-smooth hover:shadow-elegant p-8">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl gradient-primary">
                <Zap className="h-7 w-7 text-white" />
              </div>
              <h3 className="mb-3 text-xl font-semibold">Fast Setup</h3>
              <p className="text-muted-foreground">
                Create your first survey in minutes. No complex infrastructure or setup required.
              </p>
            </Card>

            <Card className="shadow-card transition-smooth hover:shadow-elegant p-8">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl gradient-primary">
                <BarChart3 className="h-7 w-7 text-white" />
              </div>
              <h3 className="mb-3 text-xl font-semibold">Deep Analytics</h3>
              <p className="text-muted-foreground">
                MNL/logit analysis, attribute importances, and scenario simulations built-in.
              </p>
            </Card>

            <Card className="shadow-card transition-smooth hover:shadow-elegant p-8">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl gradient-primary">
                <Users className="h-7 w-7 text-white" />
              </div>
              <h3 className="mb-3 text-xl font-semibold">Easy Sharing</h3>
              <p className="text-muted-foreground">
                Generate shareable links for respondents. No login required for survey participants.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 gradient-subtle">
        <div className="container mx-auto px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">How it works</h2>
          </div>

          <div className="mx-auto max-w-3xl space-y-8">
            {[
              {
                step: "01",
                title: "Connect Your Google Sheet",
                description:
                  "Share a Google Sheet with our service account. We'll create the required tabs automatically.",
              },
              {
                step: "02",
                title: "Design Your Survey",
                description: "Enter attributes and levels. We generate an optimal fractional factorial design.",
              },
              {
                step: "03",
                title: "Collect Responses",
                description: "Share your secure survey link. Responses are saved directly to your sheet.",
              },
              {
                step: "04",
                title: "Analyze Results",
                description: "Run MNL analysis with one click. Export detailed reports and insights.",
              },
            ].map((item) => (
              <Card key={item.step} className="shadow-card transition-smooth hover:shadow-elegant p-8">
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl gradient-secondary text-2xl font-bold text-white">
                      {item.step}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 text-2xl font-semibold">{item.title}</h3>
                    <p className="text-lg text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <Card className="shadow-elegant gradient-primary p-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">Ready to start your research?</h2>
            <p className="mb-8 text-lg text-white/90">Create your first conjoint study in under 5 minutes</p>
            <Link to="/start">
              <Button size="lg" variant="secondary" className="text-lg shadow-lg transition-smooth hover:scale-105">
                Get Started Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </Card>
        </div>
      </section>
    </div>
  );
};
export default Index;

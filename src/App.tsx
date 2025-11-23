import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import StartProject from "./pages/StartProject";
import OpenProject from "./pages/OpenProject";
import Workspace from "./pages/Workspace";
import SurveyResponse from "./pages/SurveyResponse";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/start" element={<StartProject />} />
        <Route path="/open" element={<OpenProject />} />
        <Route path="/workspace/:projectKey" element={<Workspace />} />
        <Route path="/s/:token" element={<SurveyResponse />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;

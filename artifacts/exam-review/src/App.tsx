import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import { AnimatedBackground } from "@/components/AnimatedBackground";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AnimatedBackground />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
        <footer className="fixed bottom-0 left-0 right-0 p-4 text-center text-sm text-muted-foreground/60 pointer-events-none z-50">
          تم التطوير بواسطة المبرمج أضم أيمن
        </footer>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

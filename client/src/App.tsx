import { Switch, Route } from "wouter";
  import { QueryClientProvider } from "@tanstack/react-query";
  import { queryClient } from "./lib/queryClient";
  import { Toaster } from "@/components/ui/toaster";
  import LoginPage from "./pages/login";
  import DashboardPage from "./pages/dashboard";
  import AdminPage from "./pages/admin";
  import NotFound from "./pages/not-found";

  function App() {
    return (
      <QueryClientProvider client={queryClient}>
        <Switch>
          <Route path="/login" component={LoginPage} />
          <Route path="/admin" component={AdminPage} />
          <Route path="/" component={DashboardPage} />
          <Route component={NotFound} />
        </Switch>
        <Toaster />
      </QueryClientProvider>
    );
  }

  export default App;
  
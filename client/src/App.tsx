import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import NotFound from "./pages/NotFound";
import Home from "./pages/Home";

const Alerts = lazy(() => import("./pages/Alerts"));
const EventExplorer = lazy(() => import("./pages/EventExplorer"));
const Forecasts = lazy(() => import("./pages/Forecasts"));
const Safety = lazy(() => import("./pages/Safety"));
const SystemHealth = lazy(() => import("./pages/SystemHealth"));

function RouteLoading() {
  return <main className="grid min-h-screen place-items-center bg-[#f5f7f8] px-6 text-center"><div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 text-sm font-bold text-slate-600 shadow-sm">Monitoring view ကို ဖွင့်နေပါသည်…</div></main>;
}

function DeferredAlerts() { return <Suspense fallback={<RouteLoading />}><Alerts /></Suspense>; }
function DeferredEventExplorer() { return <Suspense fallback={<RouteLoading />}><EventExplorer /></Suspense>; }
function DeferredForecasts() { return <Suspense fallback={<RouteLoading />}><Forecasts /></Suspense>; }
function DeferredSafety() { return <Suspense fallback={<RouteLoading />}><Safety /></Suspense>; }
function DeferredSystemHealth() { return <Suspense fallback={<RouteLoading />}><SystemHealth /></Suspense>; }

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/alerts" component={DeferredAlerts} />
    <Route path="/events" component={DeferredEventExplorer} />
    <Route path="/forecasts" component={DeferredForecasts} />
    <Route path="/safety" component={DeferredSafety} />
    <Route path="/status" component={DeferredSystemHealth} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light" switchable><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}

export default App;

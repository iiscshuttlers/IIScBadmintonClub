import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/NotFound';
import { Route, Switch, Router } from 'wouter';

import StatusBanner from "@/components/StatusBanner";

import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import Home from './pages/Home';
import About from './pages/About';
import Facilities from './pages/Facilities';
import Events from './pages/Events';
import Announcements from './pages/Announcements';
import FarewellMatchPage from './pages/FarewellMatchPage';
import Gallery from './pages/Gallery';
import Contact from './pages/Contact';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import TournamentDetail from './pages/TournamentDetail';
import FarewellBrackets from './pages/FarewellBrackets';

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
      <Route path="/facilities" component={Facilities} />

      {/* Specific routes first */}
      <Route path="/events/farewell-match" component={FarewellMatchPage} />
      <Route path="/events/:slug" component={TournamentDetail} />

      {/* Generic */}
      <Route path="/events" component={Events} />

      <Route path="/announcements" component={Announcements} />
      <Route path="/gallery" component={Gallery} />
      <Route path="/contact" component={Contact} />
      <Route path="/farewell" component={FarewellBrackets} />

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />

          {/* ✅ CLEAN ROUTER */}
          <Router base="/iiscshuttlers">
            <div className="flex flex-col min-h-screen">
              <Navigation />
              <StatusBanner />
              <main className="flex-1">
                <AppRoutes />
              </main>
              <Footer />
            </div>
          </Router>

        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
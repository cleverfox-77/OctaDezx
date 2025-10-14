import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, MessageSquare, Users, Zap } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Bot className="h-8 w-8 text-primary" />
            <span className="text-xl sm:text-2xl font-bold">OctaDezx AI</span>
          </div>
          <nav className="hidden md:flex items-center space-x-4">
            <Link to="/pricing">
              <Button variant="ghost">Pricing</Button>
            </Link>
            <Link to="/auth">
              <Button>Get Started</Button>
            </Link>
          </nav>
          <div className="md:hidden flex items-center space-x-2">
            <Link to="/pricing">
              <Button variant="ghost" size="sm">Pricing</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 sm:py-16">
        <div className="text-center mb-12 sm:mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 sm:mb-6">
            Smart AI Customer Service for Your Business
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Train an AI assistant to handle customer inquiries, show product images, 
            and escalate complex issues to your team automatically.
          </p>
          <Link to="/pricing">
            <Button size="lg" className="text-base sm:text-lg px-6 py-4 sm:px-8 sm:py-6">
              See Pricing
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12 sm:mb-16">
          <Card>
            <CardHeader>
              <Zap className="h-10 w-10 sm:h-12 sm:w-12 text-primary mb-4" />
              <CardTitle>Quick Setup</CardTitle>
              <CardDescription>
                Train your AI in minutes with your business policies and product catalog
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <MessageSquare className="h-10 w-10 sm:h-12 sm:w-12 text-primary mb-4" />
              <CardTitle>Smart Responses</CardTitle>
              <CardDescription>
                AI handles customer questions and shows relevant product images automatically
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Users className="h-10 w-10 sm:h-12 sm:w-12 text-primary mb-4" />
              <CardTitle>Human Handoff</CardTitle>
              <CardDescription>
                Complex issues are escalated to your team with full conversation context
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="text-center">
          <h2 className="text-3xl font-bold mb-8">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8 text-left">
            <Card>
              <CardHeader>
                <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold mb-4">
                  1
                </div>
                <CardTitle>Setup Your AI</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Configure your business details, policies, and upload your product catalog with images
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold mb-4">
                  2
                </div>
                <CardTitle>Share Chat Link</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Add the generated chat link to your auto-reply messages or website
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold mb-4">
                  3
                </div>
                <CardTitle>Monitor & Manage</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Track conversations and handle escalated cases from your dashboard
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <footer className="border-t bg-card mt-12 sm:mt-16">
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-muted-foreground">
            © 2024 OctaDezx AI. Transforming customer service with intelligent automation.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;

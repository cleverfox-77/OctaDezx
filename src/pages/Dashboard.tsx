import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LogOut, Bot, MessageSquare, Users, Settings, BookOpen, BarChart2, User as UserIcon, Copy } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import BusinessSetup from "@/components/BusinessSetup";
import ProductCatalog from "@/components/ProductCatalog";
import ChatSessions from "@/components/ChatSessions";
import KnowledgeBase from "./KnowledgeBase";
import Analytics from "./Analytics";
import UserProfile from "@/components/UserProfile";
import BusinessSettings from "@/components/BusinessSettings";
import { type Database } from "@/integrations/supabase/types";

type Business = Database["public"]["Tables"]["businesses"]["Row"];

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadBusinesses();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadBusinesses = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const businessData = data as Business[];
      
      setBusinesses(businessData || []);
      if (businessData && businessData.length > 0) {
        setSelectedBusiness(businessData[0]);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load businesses",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const generateChatLink = (businessId: string) => {
    return `${window.location.origin}/chat/${businessId}`;
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link).then(() => {
      toast({
        title: "Copied!",
        description: "Chat link copied to clipboard.",
      });
    }, (err) => {
      toast({
        title: "Error",
        description: "Failed to copy link.",
        variant: "destructive",
      });
      console.error('Could not copy text: ', err);
    });
  };
  
  const handleSettingsUpdated = (updatedBusiness: Business) => {
    setSelectedBusiness(updatedBusiness);
    setBusinesses(businesses.map(b => b.id === updatedBusiness.id ? updatedBusiness : b));
  };

  const handleBusinessNameUpdated = async (newBusinessName: string) => {
    if (!selectedBusiness) return;

    try {
      const { data, error } = await supabase
        .from('businesses')
        .update({ name: newBusinessName })
        .eq('id', selectedBusiness.id)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        // Update both the selected business and the businesses list
        setSelectedBusiness(data);
        setBusinesses(businesses.map(b => b.id === data.id ? data : b));
        toast({
          title: "Business Name Updated",
          description: `The business name has been updated to \"${newBusinessName}\".`
        });
      }
    } catch (error: any) {
      toast({
        title: "Error updating business name",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 sm:mb-0">
            <Bot className="h-8 w-8 text-primary" />
            <h1 className="text-xl sm:text-2xl font-bold">OctaDezx AI Dashboard</h1>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 sm:py-8">
        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList className="grid grid-cols-3 sm:flex sm:flex-wrap h-auto sm:h-auto">
            <TabsTrigger value="profile">
              <UserIcon className="h-4 w-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="businesses">
              <MessageSquare className="h-4 w-4 mr-2" />
              Businesses
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <UserProfile onBusinessNameUpdated={handleBusinessNameUpdated} />
          </TabsContent>

          <TabsContent value="businesses">
            {businesses.length === 0 ? (
              <BusinessSetup onBusinessCreated={loadBusinesses} />
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {businesses.map((business) => (
                    <Card
                      key={business.id}
                      className={`cursor-pointer transition-all ${
                        selectedBusiness?.id === business.id
                          ? "ring-2 ring-primary"
                          : "hover:shadow-md"
                      }`}
                      onClick={() => setSelectedBusiness(business)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base sm:text-lg">{business.name}</CardTitle>
                          <Badge variant={business.is_active ? "default" : "secondary"} className="text-xs">
                            {business.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <CardDescription className="text-sm">{business.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xs sm:text-sm text-muted-foreground truncate">
                          Chat Link: {generateChatLink(business.id)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {selectedBusiness && (
                  <Tabs defaultValue="overview" className="space-y-4">
                    <TabsList className="grid grid-cols-2 sm:flex sm:flex-wrap h-auto sm:h-auto">
                      <TabsTrigger value="overview">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Overview
                      </TabsTrigger>
                      <TabsTrigger value="analytics">
                        <BarChart2 className="h-4 w-4 mr-2" />
                        Analytics
                      </TabsTrigger>
                      <TabsTrigger value="products">
                        <Settings className="h-4 w-4 mr-2" />
                        Products
                      </TabsTrigger>
                      <TabsTrigger value="chats">
                        <Users className="h-4 w-4 mr-2" />
                        Chat Sessions
                      </TabsTrigger>
                      <TabsTrigger value="knowledge-base">
                        <BookOpen className="h-4 w-4 mr-2" />
                        Knowledge Base
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview">
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-semibold mb-2">Chat Link</h4>
                                <div className="flex items-center space-x-2">
                                <div className="bg-muted p-3 rounded-md overflow-x-auto flex-grow">
                                    <code className="text-sm whitespace-nowrap">
                                    {generateChatLink(selectedBusiness.id)}
                                    </code>
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleCopyLink(generateChatLink(selectedBusiness!.id))}
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                                </div>
                                <p className="text-sm text-muted-foreground mt-2">
                                Share this link with your customers or add it to your auto-reply messages
                                </p>
                            </div>
                            <BusinessSettings 
                                business={selectedBusiness} 
                                onSettingsUpdated={handleSettingsUpdated} 
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="analytics">
                      <Analytics businessId={selectedBusiness.id} />
                    </TabsContent>

                    <TabsContent value="products">
                      <ProductCatalog businessId={selectedBusiness.id} />
                    </TabsContent>

                    <TabsContent value="chats">
                      <ChatSessions businessId={selectedBusiness.id} />
                    </TabsContent>

                    <TabsContent value="knowledge-base">
                      <KnowledgeBase businessId={selectedBusiness.id} />
                    </TabsContent>
                  </Tabs>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { MessageSquare, AlertTriangle, CheckCircle, Clock, Send, User, Image as ImageIcon, X, Globe, Facebook, Instagram, Twitter, Youtube, Linkedin, Search, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Textarea } from "@/components/ui/textarea";

interface ChatSession {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  status: 'active' | 'escalated' | 'resolved' | 'manual';
  escalation_reason: string | null;
  created_at: string;
  source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer_url: string | null;
  messages: Array<{
    id: string;
    sender_type: 'customer' | 'ai' | 'human';
    content: string;
    image_url: string | null;
    created_at: string;
  }>;
}

interface ChatSessionsProps {
  businessId: string;
}

const ChatSessions = ({ businessId }: ChatSessionsProps) => {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [newMessage, setNewMessage] = useState("");
  
  // New State for Image Upload
  const [stagedImage, setStagedImage] = useState<File | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSendingRef = useRef(false);

  useEffect(() => {
    // console.log('Business ID changed:', businessId);
    loadSessions();
  }, [businessId]);

  useEffect(() => {
    if (selectedSession) {
      // console.log('Selected session updated:', selectedSession.id, selectedSession.status);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [selectedSession?.messages, selectedSession?.status]);

  const loadSessions = async () => {
    try {
      // console.log('Loading sessions for business:', businessId);
      const { data, error } = await supabase
        .from("chat_sessions")
        .select(`
          *,
          chat_messages (
            id,
            sender_type,
            content,
            image_url,
            created_at
          )
        `)
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const loadedSessions = data?.map(session => ({
        ...session,
        // Map database status back to our frontend status
        status: (session.status === 'escalated' ? 'manual' : session.status) as ChatSession['status'],
        messages: (session.chat_messages || []).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map((msg: any) => ({
          ...msg,
          sender_type: msg.sender_type as 'customer' | 'ai' | 'human'
        }))
      })) || [];
      
      // console.log('Loaded sessions:', loadedSessions.length);
      setSessions(loadedSessions);

      // Update selected session if it exists (to keep it live)
      if (selectedSession) {
        const updatedSelectedSession = loadedSessions.find(s => s.id === selectedSession.id);
        if (updatedSelectedSession) {
          // Preserve current status if we just changed it optimistically
          setSelectedSession(prev => ({
            ...updatedSelectedSession,
            status: prev?.status || updatedSelectedSession.status
          }));
        }
      }

    } catch (error) {
      console.error('Error loading sessions:', error);
      toast({
        title: "Error",
        description: "Failed to load chat sessions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setStagedImage(e.target.files[0]);
    }
  };

  const handleSendMessage = async () => {
    if (isSendingRef.current || (!newMessage.trim() && !stagedImage) || !selectedSession) return;

    // --- OPTIMISTIC UPDATE START ---
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      sender_type: 'human' as const,
      content: newMessage.trim(),
      image_url: stagedImage ? URL.createObjectURL(stagedImage) : null,
      created_at: new Date().toISOString()
    };

    const updatedSession = {
      ...selectedSession,
      messages: [...selectedSession.messages, optimisticMessage]
    };
    
    setSelectedSession(updatedSession);
    setSessions(prev => prev.map(s => s.id === selectedSession.id ? updatedSession : s));
    
    const contentToSend = newMessage.trim();
    const imageToSend = stagedImage;
    
    setNewMessage("");
    setStagedImage(null);
    // --- OPTIMISTIC UPDATE END ---

    isSendingRef.current = true;

    try {
      let imageUrl: string | null = null;

      if (imageToSend) {
        const fileExt = imageToSend.name.split('.').pop();
        const fileName = `${selectedSession.id}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('chat-files')
          .upload(fileName, imageToSend);
        
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('chat-files').getPublicUrl(fileName);
        imageUrl = data.publicUrl;
      }

      const { error } = await supabase.from('chat_messages').insert([
        {
          session_id: selectedSession.id,
          sender_type: 'human',
          content: contentToSend,
          image_url: imageUrl
        },
      ]);

      if (error) throw error;

      // Background refresh to get real DB data (IDs, etc)
      loadSessions();

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message.",
        variant: "destructive",
      });
      loadSessions(); // Revert on error
    } finally {
      isSendingRef.current = false;
    }
  };

  const updateSessionStatus = async (sessionId: string, status: ChatSession['status']) => {
    // console.log('🔄 Updating session status:', sessionId, 'to:', status);
    
    // Map 'manual' to 'escalated' for database compatibility
    const dbStatus = status === 'manual' ? 'escalated' : status;
    
    // Optimistic Update
    setSessions(prevSessions => prevSessions.map(s => 
      s.id === sessionId ? { ...s, status: status } : s
    ));

    if (selectedSession && selectedSession.id === sessionId) {
      setSelectedSession({ ...selectedSession, status: status });
    }

    toast({
      title: "Success",
      description: `Session marked as ${status}`,
    });
    
    try {
      const { error } = await supabase
        .from("chat_sessions")
        .update({ status: dbStatus })
        .eq("id", sessionId);

      if (error) throw error;

      // Background refresh
      loadSessions();

    } catch (error: any) {
      console.error('❌ Update error:', error);
      loadSessions(); // Revert
      toast({
        title: "Error",
        description: error.message || "Failed to update session status",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Clock className="h-4 w-4" />;
      case 'escalated': return <AlertTriangle className="h-4 w-4" />;
      case 'resolved': return <CheckCircle className="h-4 w-4" />;
      case 'manual': return <User className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'escalated': return 'destructive';
      case 'resolved': return 'secondary';
      case 'manual': return 'default';
      default: return 'default';
    }
  };

  const getSourceIcon = (source: string | null) => {
    if (!source) return <Globe className="h-3 w-3" />;
    const s = source.toLowerCase();
    if (s.includes('facebook') || s === 'fb') return <Facebook className="h-3 w-3" />;
    if (s.includes('instagram') || s === 'ig') return <Instagram className="h-3 w-3" />;
    if (s.includes('twitter') || s === 'x') return <Twitter className="h-3 w-3" />;
    if (s.includes('youtube') || s === 'yt') return <Youtube className="h-3 w-3" />;
    if (s.includes('linkedin')) return <Linkedin className="h-3 w-3" />;
    if (s.includes('google')) return <Search className="h-3 w-3" />;
    if (s === 'direct') return <Globe className="h-3 w-3" />;
    return <ExternalLink className="h-3 w-3" />;
  };

  const getSourceLabel = (session: ChatSession) => {
    if (session.utm_campaign) {
      return `${session.source || 'unknown'} (${session.utm_campaign})`;
    }
    return session.source || 'direct';
  };

  const getSourceColor = (source: string | null): "default" | "secondary" | "destructive" | "outline" => {
    if (!source) return 'outline';
    const s = source.toLowerCase();
    if (s.includes('facebook') || s === 'fb') return 'default';
    if (s.includes('instagram') || s === 'ig') return 'secondary';
    if (s.includes('google')) return 'destructive';
    return 'outline';
  };

  if (loading) {
    return <div className="text-center py-8">Loading chat sessions...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Chat Sessions</h3>
        <p className="text-sm text-muted-foreground">
          Monitor customer conversations and handle escalated cases
        </p>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              No chat sessions yet. Share your chat link with customers to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => (
            <Card key={session.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {session.customer_name || 'Anonymous Customer'}
                    </CardTitle>
                    <CardDescription>
                      {session.customer_email} • {formatDistanceToNow(new Date(session.created_at))} ago
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2 flex-wrap gap-1">
                    {session.source && (
                      <Badge variant={getSourceColor(session.source)} className="flex items-center space-x-1" title={session.referrer_url || undefined}>
                        {getSourceIcon(session.source)}
                        <span className="capitalize text-xs">{getSourceLabel(session)}</span>
                      </Badge>
                    )}
                    <Badge variant={getStatusColor(session.status) as any} className="flex items-center space-x-1">
                      {getStatusIcon(session.status)}
                      <span className="capitalize">{session.status}</span>
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {session.messages.length} message(s)
                    {session.escalation_reason && (
                      <span className="ml-2 text-destructive">
                        • {session.escalation_reason}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex space-x-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            // console.log('Opening session:', session.id, 'status:', session.status);
                            setSelectedSession(session);
                          }}
                        >
                          View Chat
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                        <DialogHeader>
                          <DialogTitle>
                            Chat with {selectedSession?.customer_name || 'Anonymous Customer'}
                          </DialogTitle>
                          <DialogDescription>
                            {selectedSession?.customer_email} • {selectedSession && formatDistanceToNow(new Date(selectedSession.created_at))} ago
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <span>Status:</span>
                              <Badge variant={getStatusColor(selectedSession?.status || 'active')}>
                                {selectedSession?.status}
                              </Badge>
                              {selectedSession?.source && (
                                <>
                                  <span className="ml-2">Source:</span>
                                  <Badge variant={getSourceColor(selectedSession.source)} className="flex items-center space-x-1">
                                    {getSourceIcon(selectedSession.source)}
                                    <span className="capitalize">{getSourceLabel(selectedSession)}</span>
                                  </Badge>
                                </>
                              )}
                            </div>
                            {selectedSession?.referrer_url && (
                              <div className="text-xs mt-1 text-muted-foreground truncate max-w-md">
                                Referrer: {selectedSession.referrer_url}
                              </div>
                            )}
                          </DialogDescription>
                        </DialogHeader>
                        
                        <ScrollArea className="h-[60vh] pr-4">
                          <div className="space-y-4 py-4">
                            {selectedSession?.messages.map((message) => (
                              <div
                                key={message.id}
                                className={`flex ${
                                  message.sender_type === 'customer' ? 'justify-start' : 'justify-end'
                                }`}
                              >
                                <div
                                  className={`max-w-[70%] rounded-lg p-3 break-words ${
                                    message.sender_type === 'customer'
                                      ? 'bg-muted'
                                      : message.sender_type === 'ai'
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-secondary text-secondary-foreground'
                                  }`}
                                >
                                  <div className="text-xs opacity-70 mb-1 capitalize">
                                    {message.sender_type === 'customer' ? selectedSession?.customer_name || 'Customer' : message.sender_type === 'ai' ? 'AI Assistant' : 'You'}
                                  </div>
                                  <div className="text-sm">{message.content}</div>
                                  {message.image_url && (
                                    <img
                                      src={message.image_url}
                                      alt="Message attachment"
                                      className="mt-2 max-w-full rounded border"
                                    />
                                  )}
                                  <div className="text-xs opacity-70 mt-1 text-right">
                                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                                  </div>
                                </div>
                              </div>
                            ))}
                            <div ref={messagesEndRef} />
                          </div>
                        </ScrollArea>
                        
                        <div className="mt-auto pt-4 border-t">
                          {selectedSession?.status === 'manual' ? (
                            <div className="space-y-2">
                              {/* Staged Image Preview */}
                              {stagedImage && (
                                <div className="flex items-center justify-between bg-muted p-2 rounded text-sm">
                                  <span className="truncate max-w-[200px]">{stagedImage.name}</span>
                                  <Button variant="ghost" size="icon" onClick={() => setStagedImage(null)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                              
                              {/* Input Area */}
                              <div className="flex space-x-2">
                                <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()}>
                                  <ImageIcon className="h-4 w-4" />
                                </Button>
                                <input 
                                  type="file" 
                                  ref={fileInputRef} 
                                  className="hidden" 
                                  accept="image/*" 
                                  onChange={handleImageUpload}
                                />
                                <Textarea
                                  value={newMessage}
                                  onChange={(e) => setNewMessage(e.target.value)}
                                  placeholder="Type your manual reply..."
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleSendMessage();
                                    }
                                  }}
                                  className="flex-grow min-h-[2.5rem]"
                                />
                                <Button 
                                  onClick={handleSendMessage} 
                                  disabled={!newMessage.trim() && !stagedImage}
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2 justify-end">
                              <Button 
                                variant="secondary" 
                                onClick={() => updateSessionStatus(selectedSession!.id, 'manual')}
                              >
                                <User className="mr-2 h-4 w-4" />
                                Reply Manually
                              </Button>
                              {selectedSession && selectedSession.status !== 'resolved' && (
                                <Button 
                                  onClick={() => updateSessionStatus(selectedSession.id, 'resolved')}
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Mark Resolved
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatSessions;
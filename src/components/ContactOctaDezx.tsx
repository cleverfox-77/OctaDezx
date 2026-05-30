import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Star, Send, MessageCircle } from "lucide-react";
import { LogoIcon } from "@/components/ui/Logo";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface Ticket {
  id: string;
  subject: string;
  message: string;
  admin_reply: string | null;
  status: 'open' | 'resolved';
  created_at: string;
}

export default function ContactOctaDezx() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Support State
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  
  // Feedback State
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (user) {
      loadMyTickets();

      // Realtime subscription to see replies instantly
      const channel = supabase
        .channel('public:platform_support_tickets')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'platform_support_tickets',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            loadMyTickets();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const loadMyTickets = async () => {
    const { data } = await supabase
      .from("platform_support_tickets")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });
      
    if (data) setMyTickets(data as Ticket[]);
  };

  const handleSubmitTicket = async () => {
    if (!subject || !message) return;
    try {
      const { error } = await supabase.from("platform_support_tickets").insert([{
        user_id: user!.id,
        subject,
        message,
        status: 'open'
      }]);
      if (error) throw error;
      toast({ title: "Ticket Sent", description: "Our team will reply shortly." });
      setSubject("");
      setMessage("");
      loadMyTickets();
    } catch (e) {
      toast({ title: "Error", description: "Failed to send ticket.", variant: "destructive" });
    }
  };

  const handleSubmitFeedback = async () => {
    try {
      const { error } = await supabase.from("platform_feedback").insert([{
        user_id: user!.id,
        rating,
        comment: feedback
      }]);
      if (error) throw error;
      toast({ title: "Thank you!", description: "We appreciate your feedback." });
      setFeedback("");
    } catch (e) {
      toast({ title: "Error", description: "Failed to send feedback.", variant: "destructive" });
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* LEFT: SUPPORT FORM */}
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle>Contact Support</CardTitle>
          <CardDescription>Facing issues? Let us know.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 flex-1">
          <Input placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
          <Textarea placeholder="Describe your issue..." value={message} onChange={e => setMessage(e.target.value)} className="min-h-[100px]" />
          <Button onClick={handleSubmitTicket} className="w-full"><Send className="mr-2 h-4 w-4" /> Send Ticket</Button>
          
          <div className="mt-8">
            <h4 className="font-semibold mb-4">Your Recent Tickets</h4>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {myTickets.map(ticket => (
                <Dialog key={ticket.id}>
                  <DialogTrigger asChild>
                    <div 
                      className={`border p-3 rounded-lg text-sm cursor-pointer transition-colors hover:bg-accent ${ticket.status === 'resolved' ? 'border-green-200 bg-green-50/50' : ''}`}
                    >
                      <div className="flex justify-between mb-2">
                        <span className="font-medium truncate pr-2">{ticket.subject}</span>
                        <Badge variant={ticket.status === 'open' ? 'destructive' : 'default'} className="shrink-0">{ticket.status}</Badge>
                      </div>
                      <p className="text-muted-foreground line-clamp-2">{ticket.message}</p>
                      
                      {ticket.admin_reply && (
                        <div className="mt-2 flex items-center text-green-600 text-xs font-medium">
                          <MessageCircle className="w-3 h-3 mr-1" />
                          Reply Received
                        </div>
                      )}
                      
                      <div className="mt-2 text-xs text-muted-foreground text-right">
                        {formatDistanceToNow(new Date(ticket.created_at))} ago
                      </div>
                    </div>
                  </DialogTrigger>
                  
                  {/* --- TICKET DETAILS DIALOG --- */}
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{ticket.subject}</DialogTitle>
                      <DialogDescription>
                        Status: <Badge variant={ticket.status === 'open' ? 'destructive' : 'default'}>{ticket.status}</Badge>
                        <span className="ml-2 text-xs">{new Date(ticket.created_at).toLocaleString()}</span>
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 mt-4">
                      <div className="bg-muted p-4 rounded-md">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Your Message:</p>
                        <p className="text-sm">{ticket.message}</p>
                      </div>

                      {ticket.admin_reply ? (
                        <div className="bg-green-50 border border-green-100 p-4 rounded-md">
                          <p className="text-xs font-bold text-green-700 mb-1 flex items-center">
                            <LogoIcon size="sm" className="w-3 h-3 mr-1" /> OctaDezx Support:
                          </p>
                          <p className="text-sm text-gray-800">{ticket.admin_reply}</p>
                        </div>
                      ) : (
                        <div className="text-center py-4 text-sm text-muted-foreground italic">
                          Waiting for reply...
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              ))}
              {myTickets.length === 0 && <p className="text-muted-foreground text-xs text-center py-4">No tickets yet.</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RIGHT: FEEDBACK FORM */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Rate OctaDezx</CardTitle>
          <CardDescription>How are we doing?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <div className="flex justify-center space-x-2">
            {[1, 2, 3, 4, 5].map(star => (
              <Star 
                key={star} 
                className={`h-8 w-8 cursor-pointer transition-all hover:scale-110 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} 
                onClick={() => setRating(star)} 
              />
            ))}
          </div>
          <Textarea placeholder="Tell us what you think..." value={feedback} onChange={e => setFeedback(e.target.value)} />
          <Button variant="secondary" onClick={handleSubmitFeedback} className="w-full">Submit Feedback</Button>
        </CardContent>
      </Card>
    </div>
  );
}
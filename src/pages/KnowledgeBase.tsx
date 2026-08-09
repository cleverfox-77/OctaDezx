import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Pencil, Trash2, Upload, Loader2, FileUp } from 'lucide-react';

interface KnowledgeBaseProps {
  businessId: string;
}

interface Entry {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
  url?: string;
  source_type?: string;
}

const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ businessId }) => {
  const { toast } = useToast();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [newEntry, setNewEntry] = useState({ title: "", content: "" });
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readAsBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please upload a file under 10 MB.", variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const dataBase64 = await readAsBase64(file);
      const lower = file.name.toLowerCase();
      const mimeType =
        file.type ||
        (lower.endsWith(".csv") ? "text/csv" : lower.endsWith(".md") ? "text/markdown" : lower.endsWith(".json") ? "application/json" : "text/plain");
      const { data, error } = await supabase.functions.invoke("train-file", {
        body: { businessId, filename: file.name, mimeType, dataBase64 },
      });
      if (error) {
        let msg = error.message;
        try { const j = await (error as any).context.json(); if (j?.error) msg = j.error; } catch { /* keep generic */ }
        throw new Error(msg);
      }
      const added = (data as any)?.added ?? 0;
      toast({ title: "AI trained", description: `Added ${added} knowledge ${added === 1 ? "entry" : "entries"} from ${file.name}.` });
      fetchEntries();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message ?? String(err), variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    if (businessId) {
      fetchEntries();
    }
  }, [businessId]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('knowledge_base_articles')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching entries",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.title || !newEntry.content) {
      toast({
        title: "Incomplete form",
        description: "Please fill out both title and content.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('knowledge_base_articles')
        .insert([
          {
            business_id: businessId,
            title: newEntry.title,
            content: newEntry.content
          }
        ])
        .select();

      if (error) throw error;

      if (data) {
        setEntries([data[0], ...entries]);
        setNewEntry({ title: "", content: "" });
        toast({
          title: "Success",
          description: "New entry created.",
        });
      }

    } catch (error: any) {
      toast({
        title: "Error creating entry",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;

    try {
      const { data, error } = await supabase
        .from('knowledge_base_articles')
        .update({ title: editingEntry.title, content: editingEntry.content })
        .eq('id', editingEntry.id)
        .select();

      if (error) throw error;

      if (data) {
        setEntries(entries.map(entry => entry.id === editingEntry.id ? data[0] : entry));
        setEditingEntry(null);
        toast({
          title: "Success",
          description: "Entry updated.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error updating entry",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (window.confirm("Are you sure you want to delete this entry?")) {
      try {
        const { error } = await supabase
          .from('knowledge_base_articles')
          .delete()
          .eq('id', entryId);

        if (error) throw error;

        setEntries(entries.filter(entry => entry.id !== entryId));
        toast({
          title: "Success",
          description: "Entry deleted.",
        });
      } catch (error: any) {
        toast({
          title: "Error deleting entry",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Knowledge Base</h1>
        <p className="text-muted-foreground">
          This section allows you to add and manage the information your AI assistant will use to answer customer questions.
        </p>
      </div>

      {/* File Upload Training */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileUp className="h-5 w-5 text-primary" /> Train from a file</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Upload a PDF, CSV, image or text file (a menu, price list, policy doc, FAQ sheet) and OctaDezx reads it straight into your knowledge base. Your AI can answer from it within seconds.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.csv,.txt,.md,.json,.png,.jpg,.jpeg,.webp,image/*,text/*,application/pdf"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button type="button" variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()} className="gap-2">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Reading your file…" : "Choose a file"}
          </Button>
          <p className="text-xs text-muted-foreground">PDF, CSV, TXT, MD, JSON or image, up to 10 MB. For Word or other documents, export to PDF first.</p>
        </CardContent>
      </Card>

      {/* Manual Entry Form */}
      <Card>
        <CardHeader>
          <CardTitle>Add New Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateEntry} className="space-y-4">
            <Input
              placeholder="Topic Title (e.g., 'Return Policy' or 'Sizing Guide')"
              value={newEntry.title}
              onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
            />
            <Textarea
              placeholder="Detailed Content. Tip: Write this like a Q&A. 
Example: 'Q: How do returns work? A: You can return items within 30 days if they are unworn...'"
              value={newEntry.content}
              onChange={(e) => setNewEntry({ ...newEntry, content: e.target.value })}
              rows={5}
            />
            <Button type="submit">Add Entry</Button>
          </form>
        </CardContent>
      </Card>

      {/* Entry List */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading entries...</p>
          ) : entries.length === 0 ? (
            <p>No entries found. Add one above or run the scraper to get started!</p>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => (
                <div key={entry.id} className="p-4 border rounded-md">
                  {editingEntry && editingEntry.id === entry.id ? (
                    <form onSubmit={handleUpdateEntry} className="space-y-4">
                      <Input
                        value={editingEntry.title}
                        onChange={(e) => setEditingEntry({ ...editingEntry, title: e.target.value })}
                      />
                      <Textarea
                        value={editingEntry.content || ''}
                        onChange={(e) => setEditingEntry({ ...editingEntry, content: e.target.value })}
                        rows={5}
                      />
                      <div className="flex space-x-2">
                        <Button type="submit">Save</Button>
                        <Button variant="outline" onClick={() => setEditingEntry(null)}>Cancel</Button>
                      </div>
                    </form>
                  ) : (
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg">{entry.title}</h3>
                            {entry.source_type === 'scraper' && (
                              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full border border-blue-200">
                                Scraper
                              </span>
                            )}
                            {entry.source_type === 'file' && (
                              <span className="bg-violet-100 text-violet-800 text-xs px-2 py-0.5 rounded-full border border-violet-200">
                                File
                              </span>
                            )}
                            {entry.url && (
                              <a href={entry.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:underline">
                                {entry.url}
                              </a>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</p>
                        </div>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="icon" onClick={() => setEditingEntry(entry)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteEntry(entry.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap max-h-40 overflow-y-auto">{entry.content || 'No content'}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default KnowledgeBase;
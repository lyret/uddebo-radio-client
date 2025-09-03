import { useState } from "react";
import { Upload, Music, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const RecordingUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check if it's an audio file
      if (!file.type.startsWith('audio/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an audio file",
          variant: "destructive",
        });
        return;
      }
      
      // Check file size (limit to 50MB)
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select a file smaller than 50MB",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedFile(file);
      
      // Auto-fill title from filename if not already set
      if (!title) {
        const filename = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
        setTitle(filename);
      }
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  const handleUpload = async () => {
    if (!selectedFile || !title.trim()) {
      toast({
        title: "Missing information",
        description: "Please select a file and provide a title",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to upload recordings",
          variant: "destructive",
        });
        return;
      }

      // Upload file to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('recordings')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('recordings')
        .getPublicUrl(fileName);

      // Create audio element to get duration
      const audio = new Audio();
      audio.src = URL.createObjectURL(selectedFile);
      
      await new Promise((resolve) => {
        audio.addEventListener('loadedmetadata', resolve);
        audio.load();
      });

      const duration = Math.floor(audio.duration);

      // Save recording metadata to database
      const { error: dbError } = await supabase
        .from('recordings')
        .insert({
          title: title.trim(),
          artist: artist.trim() || null,
          file_url: publicUrl,
          file_size: selectedFile.size,
          duration,
          uploaded_by: user.id,
        });

      if (dbError) throw dbError;

      toast({
        title: "Upload successful!",
        description: "Your recording has been added to the playlist",
      });

      // Reset form
      setSelectedFile(null);
      setTitle("");
      setArtist("");
      
      // Reset file input
      const fileInput = document.getElementById('audio-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "There was an error uploading your recording",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-secondary/20 border-border/50 backdrop-blur-sm">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Upload Recording
          </h2>
          <p className="text-muted-foreground">
            Add your music to the Uddebo Radio playlist
          </p>
        </div>

        <div className="space-y-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="audio-file">Audio File</Label>
            {!selectedFile ? (
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                <input
                  id="audio-file"
                  type="file"
                  accept="audio/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <label htmlFor="audio-file" className="cursor-pointer">
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Click to select an audio file
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Supports MP3, WAV, M4A, and other audio formats (max 50MB)
                    </p>
                  </div>
                </label>
              </div>
            ) : (
              <div className="border border-border rounded-lg p-4 bg-secondary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Music className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={removeFile}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter the song title"
              className="bg-background/50"
            />
          </div>

          {/* Artist */}
          <div className="space-y-2">
            <Label htmlFor="artist">Artist</Label>
            <Input
              id="artist"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Enter the artist name"
              className="bg-background/50"
            />
          </div>

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || !title.trim() || uploading}
            className="w-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
            size="lg"
          >
            {uploading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Uploading...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Upload className="h-4 w-4" />
                <span>Upload Recording</span>
              </div>
            )}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p>By uploading, you confirm you have the rights to share this content.</p>
          <p>Uploaded files will be publicly accessible on Uddebo Radio.</p>
        </div>
      </div>
    </Card>
  );
};
import { useState } from "react";
import { Radio, Upload } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioPlayer } from "@/components/RadioPlayer";
import { RecordingUpload } from "@/components/RecordingUpload";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Radio className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Uddebo Radio
              </h1>
              <p className="text-sm text-muted-foreground">
                Community-driven radio streaming
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Tabs defaultValue="player" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="player" className="flex items-center space-x-2">
              <Radio className="h-4 w-4" />
              <span>Radio Player</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center space-x-2">
              <Upload className="h-4 w-4" />
              <span>Upload Recording</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="player" className="space-y-6">
            <RadioPlayer />
          </TabsContent>

          <TabsContent value="upload" className="space-y-6">
            <RecordingUpload />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/30 backdrop-blur-sm mt-16">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>© 2024 Uddebo Radio - Sharing music, connecting communities</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;

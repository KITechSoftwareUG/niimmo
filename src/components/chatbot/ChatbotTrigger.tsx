import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { ImprovedChatbot } from "./ImprovedChatbot";

export function ChatbotTrigger() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <>
      {!isChatOpen && (
        <div className="fixed bottom-4 right-4 z-40">
          <Button
            onClick={() => setIsChatOpen(true)}
            size="lg"
            className="h-14 w-14 rounded-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-2xl animate-pulse hover:animate-none transition-all duration-300"
          >
            <MessageCircle className="h-6 w-6" />
          </Button>
        </div>
      )}
      
      <ImprovedChatbot 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
      />
    </>
  );
}
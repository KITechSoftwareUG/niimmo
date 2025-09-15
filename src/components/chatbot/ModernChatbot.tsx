import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Zap, 
  Sparkles, 
  MessageCircle, 
  Send, 
  Trash2, 
  X,
  Bot,
  User,
  Bell
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  isNotification?: boolean;
}

interface ModernChatbotProps {
  isOpen: boolean;
  onClose: () => void;
}

const CHAT_API_URL = "https://k01-2025-u36730.vm.elestio.app/webhook/f7e1b37f-228d-488f-ae76-36f92bb02646/chat";
const NOTIFICATIONS_API_URL = "https://k01-2025-u36730.vm.elestio.app/webhook/f7e1b37f-228d-488f-ae76-36f92bb02646/notifications";

export function ModernChatbot({ isOpen, onClose }: ModernChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      text: "Hallo! Ich bin Chilla, dein KI‑Assistent für die Immobilienverwaltung. Wie kann ich dir heute helfen?",
      isUser: false,
      timestamp: new Date(),
      isNotification: false
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Auto-focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Notification polling every 30 seconds
  useEffect(() => {
    if (!isOpen) return;

    const pollNotifications = async () => {
      try {
        const response = await fetch(`${NOTIFICATIONS_API_URL}?session_id=${sessionId}`);
        if (response.ok) {
          const notifications = await response.json();
          if (notifications && notifications.length > 0) {
            notifications.forEach((notification: any) => {
              const notificationMessage: Message = {
                id: `notification-${Date.now()}-${Math.random()}`,
                text: notification.message || notification.text,
                isUser: false,
                timestamp: new Date(),
                isNotification: true
              };
              setMessages(prev => [...prev, notificationMessage]);
            });
          }
        }
      } catch (error) {
        console.error('Error polling notifications:', error);
      }
    };

    const intervalId = setInterval(pollNotifications, 30000);
    return () => clearInterval(intervalId);
  }, [isOpen, sessionId]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: inputMessage.trim(),
      isUser: true,
      timestamp: new Date(),
      isNotification: false
    };

    setMessages(prev => [...prev, userMessage]);
    const messageToSend = inputMessage.trim();
    setInputMessage("");
    setIsLoading(true);

    try {
      const response = await fetch(CHAT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageToSend,
          timestamp: new Date().toISOString(),
          session_id: sessionId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.output || data.response || data.message || data.text || "Entschuldigung, ich konnte keine passende Antwort generieren.";
      
      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        text: aiResponse,
        isUser: false,
        timestamp: new Date(),
        isNotification: false
      };

      setMessages(prev => [...prev, aiMessage]);

    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        text: "Entschuldigung, es gab einen Fehler beim Verarbeiten Ihrer Nachricht. Bitte versuchen Sie es erneut.",
        isUser: false,
        timestamp: new Date(),
        isNotification: false
      };

      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Verbindungsfehler",
        description: "Konnte nicht mit dem KI-Service verbinden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: "welcome-new",
        text: "Chat wurde geleert. Wie kann ich Ihnen helfen?",
        isUser: false,
        timestamp: new Date(),
        isNotification: false
      }
    ]);
    toast({
      title: "Chat geleert",
      description: "Alle Nachrichten wurden entfernt.",
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-[450px] h-[580px] z-50 animate-scale-in">
      <Card className="h-full flex flex-col min-h-0 shadow-2xl border-0 overflow-hidden backdrop-blur-xl bg-white/95 dark:bg-gray-900/95">
        {/* Header */}
        <CardHeader className="bg-gradient-to-r from-red-600 to-red-900 text-white p-4 flex-shrink-0 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                <Sparkles className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Chilla
                </h3>
                <p className="text-sm text-red-100">Dein KI‑Assistent</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                onClick={clearChat}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20 h-8 w-8 p-0 transition-all duration-200 hover:scale-105"
                title="Chat leeren"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20 h-8 w-8 p-0 transition-all duration-200 hover:scale-105"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Messages */}
        <CardContent className="flex-1 min-h-0 flex flex-col p-0 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
          <ScrollArea ref={scrollAreaRef} className="flex-1 h-full p-4">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className={`flex animate-fade-in ${
                    message.isUser ? 'justify-end' : 'justify-start'
                  }`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div
                    className={`max-w-[85%] p-4 rounded-2xl backdrop-blur-sm transition-all duration-200 hover:scale-[1.02] ${
                      message.isUser
                        ? 'bg-gradient-to-r from-red-600 to-red-700 text-white rounded-br-sm shadow-lg'
                        : message.isNotification
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-bl-sm shadow-lg'
                        : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 dark:from-gray-700 dark:to-gray-600 dark:text-gray-100 rounded-bl-sm shadow-lg'
                    }`}
                  >
                    <div className="flex items-start space-x-2">
                      {!message.isUser && (
                        <div className="flex-shrink-0 mt-0.5">
                          {message.isNotification ? (
                            <Bell className="h-4 w-4" />
                          ) : (
                            <Bot className="h-4 w-4" />
                          )}
                        </div>
                      )}
                      {message.isUser && (
                        <User className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-relaxed break-words">{message.text}</p>
                        <p className={`text-xs mt-2 opacity-70`}>
                          {formatTime(message.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start animate-fade-in">
                  <div className="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 text-gray-800 dark:text-gray-100 p-4 rounded-2xl rounded-bl-sm backdrop-blur-sm shadow-lg">
                    <div className="flex items-center space-x-3">
                      <Bot className="h-4 w-4" />
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                      <span className="text-sm">Chilla denkt nach...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 border-t border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
            <div className="flex space-x-3">
              <Input
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Frag Chilla etwas…"
                disabled={isLoading}
                className="flex-1 border-2 border-gray-200 dark:border-gray-700 focus:border-red-500 dark:focus:border-red-400 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm transition-all duration-200"
              />
              <Button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                size="icon"
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 transition-all duration-200 hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
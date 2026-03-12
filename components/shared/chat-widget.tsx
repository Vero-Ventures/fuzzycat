'use client';

import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { MessageCircle, Send, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { publicEnv } from '@/lib/env';

/** Extract text content from a UIMessage's parts array. */
function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

export function ChatWidget() {
  const enabled = publicEnv().NEXT_PUBLIC_ENABLE_CHATBOT === 'true';

  if (!enabled) {
    return null;
  }

  return <ChatWidgetInner />;
}

function ChatWidgetInner() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'up' | 'down'>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, sendMessage, status, error } = useChat();

  const isLoading = status === 'submitted' || status === 'streaming';
  const messageCount = messages.length;

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messageCount]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = inputValue.trim();
      if (!text || isLoading) return;
      setInputValue('');
      sendMessage({ text });
    },
    [inputValue, isLoading, sendMessage],
  );

  const handleFeedback = useCallback(
    async (messageId: string, helpful: boolean) => {
      setFeedbackGiven((prev) => ({
        ...prev,
        [messageId]: helpful ? 'up' : 'down',
      }));
      try {
        const chatMessages = messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: getMessageText(m),
        }));
        // Fire-and-forget feedback save
        await fetch('/api/trpc/chatbot.saveFeedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ json: { messageId, helpful, messages: chatMessages } }),
        });
      } catch (error) {
        // Feedback is best-effort, don't block UX
        console.error('Failed to save chat feedback:', error);
      }
    },
    [messages],
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, []);

  return (
    <>
      {/* Floating chat button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          aria-label="Open support chat"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed bottom-20 right-6 z-40 flex w-[360px] flex-col rounded-xl border bg-background shadow-2xl max-sm:bottom-0 max-sm:right-0 max-sm:left-0 max-sm:w-full max-sm:rounded-none max-sm:h-[80vh] sm:h-[520px]"
          onKeyDown={handleKeyDown}
          role="dialog"
          aria-label="Support chat"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              <span className="text-sm font-semibold">FuzzyCat Support</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {/* Welcome message */}
            {messages.length === 0 && (
              <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                Hi! I&apos;m FuzzyCat&apos;s support assistant. Ask me anything about payment plans,
                fees, or how FuzzyCat works.
              </div>
            )}

            {messages.map((message) => {
              const text = getMessageText(message);
              return (
                <div key={message.id}>
                  <div
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      {text}
                    </div>
                  </div>
                  {/* Feedback buttons for assistant messages */}
                  {message.role === 'assistant' && text && (
                    <div className="mt-1 flex gap-1 pl-1">
                      {feedbackGiven[message.id] ? (
                        <span className="text-xs text-muted-foreground">
                          {feedbackGiven[message.id] === 'up'
                            ? 'Thanks for the feedback!'
                            : 'Sorry about that. Try the support page for more help.'}
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleFeedback(message.id, true)}
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="Helpful"
                          >
                            <ThumbsUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFeedback(message.id, false)}
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="Not helpful"
                          >
                            <ThumbsDown className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce">.</span>
                    <span className="animate-bounce [animation-delay:0.1s]">.</span>
                    <span className="animate-bounce [animation-delay:0.2s]">.</span>
                  </span>
                </div>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Something went wrong. Please try again or visit our{' '}
                <a href="/support" className="underline">
                  support page
                </a>{' '}
                for help.
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t px-4 py-3">
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask a question..."
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isLoading}
              aria-label="Chat message"
            />
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || !inputValue.trim()}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}

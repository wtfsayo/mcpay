'use client';

import { useState } from 'react';
import { ChatBody } from '@/components/custom-ui/chat-body';
import { Button } from '@/components/ui/button';
import { ChatStatus, UIMessage } from 'ai';
import { McpPreview } from './mcp-preview';
import { CodebasePreview } from './code-preview';

export interface ChatWithPreviewProps {
  id: string;
  messages: UIMessage[];
  status: ChatStatus
  isReadonly?: boolean;
  onSendMessage: (text: string) => void;
  onStop?: () => void;
  previewUrl?: string | null;
  userWalletAddress?: string;
  codebase?: string;
}

export default function ChatWithPreview({
  id,
  messages,
  status,
  isReadonly = false,
  onSendMessage,
  onStop,
  previewUrl = 'https://vercel-mcp-handler-mcpay.vercel.app/mcp',
  userWalletAddress = '0x0000000000000000000000000000000000000000',
  codebase = '',
}: ChatWithPreviewProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-1 min-h-0">
        {/* Chat pane */}
        <div className="flex-1 flex flex-col min-h-0">
          <ChatBody
            chatId={id}
            status={status}
            messages={messages}
            isReadonly={isReadonly}
            onSendMessage={onSendMessage}
            onStop={onStop}
          />
        </div>

        {/* Preview/Code pane */}
        <div className="hidden md:flex flex-col w-2/3 border-l border-gray-200 bg-background">
          <div className="flex space-x-2 p-2 border-b border-muted-background">
            <Button
              variant="ghost"
              size="sm"
              className={`px-2 transition-opacity ${activeTab === 'preview' ? 'opacity-100 bg-accent' : 'opacity-50'
                }`}
              onClick={() => setActiveTab('preview')}
            >
              Preview
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`px-2 transition-opacity ${activeTab === 'code' ? 'opacity-100 bg-accent' : 'opacity-50'
                }`}
              onClick={() => setActiveTab('code')}
            >
              Code
            </Button>
          </div>
          <div className="flex-1 flex overflow-hidden">
            {activeTab === 'preview' ? (
              previewUrl
                ? <McpPreview url={previewUrl} userWalletAddress={userWalletAddress} />
                : <div className="p-4 text-center text-muted-foreground/80">
                  No preview available.
                </div>
            ) : (
              <CodebasePreview sessionData={codebase} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// app/src/app/build/page.tsx
'use client';

import ChatWithPreview from '@/components/custom-ui/chat-with-preview';
import { useChat } from '@ai-sdk/react';
import { Suspense, useState, useCallback } from 'react';

export default function BuildPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mcpUrl, setMcpUrl] = useState<string | null>(null);

  const getSessionData = useCallback(() => ({
    sessionId,
    mcpUrl,
  }), [sessionId, mcpUrl]);

  const { sendMessage, messages, stop, status } = useChat({
    onToolCall: (toolCall) => {
      console.log('Tool call:', toolCall);
    },
    onData: (data) => {
      console.log('Data:', data);
      
      // Handle session data if it comes directly in the data stream
      if (data.type === 'data-session' && data.data) {
        const sessionData = data.data as { sessionId?: string };
        if (sessionData.sessionId) {
          console.log('Received session ID from stream:', sessionData.sessionId);
          setSessionId(sessionData.sessionId);
        }
      }
      if (data.type === 'data-preview' && data.data) {
        const previewData = data.data as { url?: string };
        if (previewData.url) {
          console.log('Received preview URL from stream:', previewData.url);
          setMcpUrl(`${previewData.url}/mcp`);
        }
      }
    },
    onFinish: (message) => {
      console.log('Chat finished:', { message });
    },
  });

  return (
    <Suspense fallback={null}>
      <ChatWithPreview
        id="main-chat"
        messages={messages}
        previewUrl={mcpUrl}
        status={status}
        isReadonly={false}
        onSendMessage={(text) => {
          console.log('sendMessage with session:', getSessionData());
          sendMessage({
            role: 'user', 
            parts: [{ type: 'text', text: text }]
          });
        }}
        onStop={stop}
      />
    </Suspense>
  );
}

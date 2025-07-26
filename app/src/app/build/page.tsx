// app/src/app/build/page.tsx
'use client';

import ChatWithPreview from '@/components/custom-ui/chat-with-preview';
import { useChat } from '@ai-sdk/react';
import { Suspense, useState, useCallback } from 'react';
import { toast } from 'sonner';

export default function BuildPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mcpUrl, setMcpUrl] = useState<string | null>(null);
  const [codebase, setCodebase] = useState<string | null>(null);

  const getSessionData = useCallback(() => ({
    sessionId,
    mcpUrl,
  }), [sessionId, mcpUrl]);

  const { sendMessage, messages, stop, status } = useChat({
    onToolCall: (toolCall) => {
      console.log('Tool call:', toolCall);
    },
    onData: (data) => {
      console.log('📦 onData received:', data.type, data);
      if (data.type === 'data-payment' && data.data) {
        const paymentData = data.data as { paid?: boolean };
        if (paymentData.paid) {
          console.log('Received payment from stream:', paymentData.paid);
          toast.success('Payment successful'); 
        }
      }

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
      if (data.type === 'data-codebase' && data.data) {
        const codebaseData = data.data as { codebase?: string };
        if (codebaseData.codebase) {
          console.log('Received codebase from stream:', codebaseData.codebase);
          setCodebase(codebaseData.codebase);
        }
      }
    },
    onFinish: (message) => {
      console.log('Chat finished:', { message });
    },
  });

  // Add logging to track messages changes
  console.log('🔄 BuildPage render - messages count:', messages.length, 'status:', status);
  console.log('🔄 Last message parts:', messages[messages.length - 1]?.parts?.length || 0);

  const _sendMessage = (text: string) => {
    sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: text }]
    }, {
      body: {
        sessionId: sessionId,
      }
    });
  }

  return (
    <Suspense fallback={null}>
      <ChatWithPreview
        id="main-chat"
        codebase={codebase || ''}
        messages={messages}
        previewUrl={mcpUrl}
        status={status}
        isReadonly={false}
        onSendMessage={(text) => {
          console.log('sendMessage with session:', getSessionData());
          _sendMessage(text);
        }}
        onStop={stop}
      />
    </Suspense>
  );
}

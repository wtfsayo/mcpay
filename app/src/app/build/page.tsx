// app/src/app/build/page.tsx
'use client';

import ChatWithPreview from '@/components/custom-ui/chat-with-preview';
import { useChat } from '@ai-sdk/react';
import { Suspense, useState } from 'react';

export default function BuildPage() {
  const { sendMessage, messages, stop, status} = useChat();

  return (
    <Suspense fallback={null}>
        <ChatWithPreview
          id="main-chat"
          messages={messages}
          status={status}
          isReadonly={false}
          onSendMessage={(text) => {
            console.log('sendMessage');
            sendMessage({role: 'user', parts: [{type: 'text', text: text}]});
          }}
          onStop={stop}
        />
    </Suspense>
  );
}

// app/src/components/custom-ui/messages.tsx
'use client';

import { Greeting } from '@/components/custom-ui/greeting';
import { memo } from 'react';
import { PreviewMessage, ThinkingMessage } from '@/components/custom-ui/message';
import { motion } from 'motion/react';
import { ChatStatus, UIMessage } from 'ai';

interface MessagesProps {
  status: ChatStatus;
  messages: UIMessage[];
}

function PureMessages({ status, messages }: MessagesProps) {
  console.log("status", status);
  return (
    <div className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4 relative">
      {messages.length === 0 && <Greeting />}

      {messages.map((message, idx) => (
        <PreviewMessage
          key={message.id}
          message={message}
          isLoading={status === 'streaming' && idx === messages.length - 1}
          requiresScrollPadding={false}
        />
      ))}

      {status === 'submitted' &&
        messages.length > 0 &&
        messages[messages.length - 1].role === 'user' && <ThinkingMessage />}

      <motion.div className="shrink-0 min-w-[24px] min-h-[24px]" />
    </div>
  );
}

export const Messages = memo(
  PureMessages,
  (prev, next) =>
    prev.status === next.status && prev.messages === next.messages
);

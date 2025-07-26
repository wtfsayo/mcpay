// app/src/components/custom-ui/tool-call-streaming.tsx
'use client';

import { FC } from 'react';
import { motion } from 'motion/react';
import { CircleCheck, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircleIcon } from './icons'

export interface ToolCallPart {
  type: string;            // e.g. "tool-create_session"
  state: 'waiting' 
        | 'running' 
        | 'output-available' 
        | 'error';
  input?: any;
  output?: any;
  toolCallId: string;
}

interface ToolCallProps {
  step: ToolCallPart;
}

export const ToolCall: FC<ToolCallProps> = ({ step }) => {
  const isDone = step.state === 'output-available';
  const isError = step.state === 'error';

  // Turn "tool-create_session" into "Create Session"
  const label = step.type
    .replace(/^tool-/, '')
    .split('_')
    .map(w => w[0].toUpperCase() + w.slice(1))
    .join(' ');

  return (
    <Card className="w-full rounded-sm py-4 border-0">
      <CardContent className="flex items-center gap-2 text-sm font-medium">
        {/* icon */}
        <div className="flex-shrink-0">
          {isDone ? (
            <CheckCircleIcon className="h-4 w-4 text-green-600" />
          ) : isError ? (
            <span className="inline-block h-4 w-4 text-red-500">Error</span>
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          )}
        </div>

        {/* label */}
        <motion.span
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 1 }}
          className={isDone ? 'text-muted-foreground' : 'text-foreground'}
        >
          {label}
        </motion.span>
      </CardContent>
    </Card>
  );
};

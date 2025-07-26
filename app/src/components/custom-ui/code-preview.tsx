'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { File, Copy, Download, FileText, Code } from 'lucide-react';
import Editor from '@monaco-editor/react';

interface FileInfo {
  content: string;
  lastModified: number;
  size: number;
  lastModifiedISO: string;
}

interface SessionData {
  files: Record<string, FileInfo>;
}

interface CodebasePreviewProps {
  sessionData: string;
}

export function CodebasePreview({ sessionData }: CodebasePreviewProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<SessionData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // theme & mount for Monaco
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const monacoTheme = mounted
    ? resolvedTheme === 'dark'
      ? 'vs-dark'
      : 'vs'
    : 'vs';

  // parse JSON
  useEffect(() => {
    try {
      const data = JSON.parse(sessionData) as SessionData;
      setParsedData(data);
      setParseError(null);
      const first = Object.keys(data.files)[0];
      if (first) setSelectedFile(first);
    } catch (err) {
      setParsedData(null);
      setParseError(err instanceof Error ? err.message : 'Invalid session data');
    }
  }, [sessionData]);

  const handleCopy = (text: string) => navigator.clipboard.writeText(text);
  const handleDownload = (name: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const fmtSize = (b: number) =>
    b < 1024
      ? `${b} B`
      : b < 1024 ** 2
      ? `${(b / 1024).toFixed(1)} KB`
      : `${(b / 1024 ** 2).toFixed(1)} MB`;

  const iconClass = 'h-4 w-4 text-muted-foreground';
  const getIcon = (fn: string) => {
    const ext = fn.split('.').pop()?.toLowerCase();
    if (['ts', 'tsx', 'js', 'jsx'].includes(ext!)) return <Code className={iconClass} />;
    if (['json', 'md'].includes(ext!)) return <FileText className={iconClass} />;
    return <File className={iconClass} />;
  };

  const getLang = (fn: string) => {
    const ext = fn.split('.').pop()?.toLowerCase();
    if (['ts', 'tsx'].includes(ext!)) return 'typescript';
    if (['js', 'jsx'].includes(ext!)) return 'javascript';
    if (ext === 'json') return 'json';
    if (ext === 'md') return 'markdown';
    if (ext === 'env') return 'bash';
    return 'text';
  };

  // Error / Loading states
  if (parseError) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-8 flex items-center px-2 bg-red-50">
          <span className="text-red-600 text-sm">Parse Error</span>
        </div>
        <div className="p-2 text-sm text-red-600 flex-1 overflow-auto">
          {parseError}
        </div>
      </div>
    );
  }
  if (!parsedData) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* File list panel */}
      <div className="w-1/3 flex-shrink-0 bg-gray-50 dark:bg-gray-800 overflow-auto p-2 space-y-1">
        {Object.keys(parsedData.files).map((fn) => (
          <Button
            key={fn}
            variant={selectedFile === fn ? 'secondary' : 'ghost'}
            className="w-full justify-start px-2 py-1 text-xs font-medium"
            onClick={() => setSelectedFile(fn)}
          >
            <div className="flex items-center gap-2">
              {getIcon(fn)}
              <span className="truncate">{fn}</span>
            </div>
          </Button>
        ))}
      </div>

      {/* Code editor panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedFile && (
          <>
            {/* _Your_ header bar at exactly one line of text */}
            <div
              className="h-8 flex items-center justify-between px-2"
              style={{ lineHeight: '2rem' }}
            >
              <div className="flex items-center gap-2 text-xs font-medium">
                {getIcon(selectedFile)}
                <span className="truncate text-foreground">{selectedFile}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {fmtSize(parsedData.files[selectedFile].size)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="p-0.5 h-6 w-6"
                  onClick={() => handleCopy(parsedData.files[selectedFile].content)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="p-0.5 h-6 w-6"
                  onClick={() =>
                    handleDownload(selectedFile, parsedData.files[selectedFile].content)
                  }
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <Separator className="my-0" />

            <div className="flex-1 overflow-auto">
              <Editor
                height="100%"
                language={getLang(selectedFile)}
                value={parsedData.files[selectedFile].content}
                theme={monacoTheme}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  wordWrap: 'on',
                  fontSize: 14,
                }}
                onMount={(editor) => {
                  editor.getModel()?.updateOptions({ tabSize: 2 });
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

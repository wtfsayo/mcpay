'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  File, 
  Folder, 
  Copy, 
  Download, 
  FileText, 
  Code,
  Calendar,
  HardDrive,
  Hash
} from 'lucide-react';
import { CodeBlock } from './code-block';
import type { Literal } from 'mdast';

interface SessionSummary {
  totalFiles: number;
  totalSize: number;
  totalSizeKB: number;
  pathFilter: string | null;
  includeContent: boolean;
}

interface FileInfo {
  content: string;
  lastModified: number;
  size: number;
  lastModifiedISO: string;
}

interface SessionData {
  sessionId: string;
  summary: SessionSummary;
  files: Record<string, FileInfo>;
}

interface CodebasePreviewProps {
  sessionData: string;
}

export function CodebasePreview({ sessionData }: CodebasePreviewProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<SessionData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Parse the session data on component mount or when data changes
  useEffect(() => {
    try {
      const data = JSON.parse(sessionData) as SessionData;
      setParsedData(data);
      setParseError(null);
      // Auto-select first file
      const firstFile = Object.keys(data.files)[0];
      if (firstFile) {
        setSelectedFile(firstFile);
      }
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Failed to parse session data');
      setParsedData(null);
    }
  }, [sessionData]);

  const handleCopyContent = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const handleDownloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (isoString: string): string => {
    return new Date(isoString).toLocaleString();
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
        return <Code className="h-4 w-4 text-blue-500" />;
      case 'json':
        return <FileText className="h-4 w-4 text-yellow-500" />;
      case 'md':
        return <FileText className="h-4 w-4 text-green-500" />;
      case 'env':
        return <File className="h-4 w-4 text-gray-500" />;
      default:
        return <File className="h-4 w-4 text-gray-400" />;
    }
  };

  const getLanguageFromFilename = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      case 'env':
        return 'bash';
      default:
        return 'text';
    }
  };

  if (parseError) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-red-600">Parse Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">{parseError}</p>
        </CardContent>
      </Card>
    );
  }

  if (!parsedData) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Loading session data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Session Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            Codebase Session
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Session ID</p>
                <p className="text-sm font-mono truncate">{parsedData.sessionId}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Total Files</p>
                <p className="text-sm font-semibold">{parsedData.summary.totalFiles}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Total Size</p>
                <p className="text-sm font-semibold">{formatFileSize(parsedData.summary.totalSize)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={parsedData.summary.includeContent ? "default" : "secondary"}>
                {parsedData.summary.includeContent ? "With Content" : "Metadata Only"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Explorer and Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* File List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Files</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="p-4 space-y-1">
                {Object.entries(parsedData.files).map(([filename, fileInfo]) => (
                  <Button
                    key={filename}
                    variant={selectedFile === filename ? "secondary" : "ghost"}
                    className="w-full justify-start h-auto p-2 font-normal"
                    onClick={() => setSelectedFile(filename)}
                  >
                    <div className="flex items-center gap-2 w-full">
                      {getFileIcon(filename)}
                      <div className="flex-1 text-left">
                        <p className="text-xs font-medium truncate">{filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(fileInfo.size)}
                        </p>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* File Content */}
        <Card className="lg:col-span-2">
          {selectedFile && parsedData.files[selectedFile] ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {getFileIcon(selectedFile)}
                    {selectedFile}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyContent(parsedData.files[selectedFile].content)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadFile(selectedFile, parsedData.files[selectedFile].content)}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(parsedData.files[selectedFile].lastModifiedISO)}
                  </span>
                  <span>{formatFileSize(parsedData.files[selectedFile].size)}</span>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <CodeBlock
                    node={{ value: parsedData.files[selectedFile].content } as Literal & { value: string }}
                    inline={false}
                    className={`language-${getLanguageFromFilename(selectedFile)}`}
                  >
                    {parsedData.files[selectedFile].content}
                  </CodeBlock>
                </ScrollArea>
              </CardContent>
            </>
          ) : (
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">
                Select a file to view its content
              </p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

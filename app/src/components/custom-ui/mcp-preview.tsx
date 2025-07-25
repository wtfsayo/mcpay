'use client';

import { api } from '@/lib/client/utils';
import { type MCPServerInfo, type MCPToolWithPayments } from '@/lib/gateway/inspect-mcp';
import type { PricingEntry } from '@/types/payments';
import { useEffect, useState } from 'react';

interface McpPreviewProps {
  url: string;
  userWalletAddress: string;
}

export function McpPreview({ url, userWalletAddress }: McpPreviewProps) {
  const [serverInfo, setServerInfo] = useState<MCPServerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchServerInfo = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Fetching MCP server info');
        const data = await api.getMcpServerInfo(url);   
        
        if (isMounted) {
          setServerInfo(data as MCPServerInfo);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching MCP server info:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch server info');
          setLoading(false);
        }
      }
    };

    fetchServerInfo();

    return () => {
      isMounted = false;
    };
  }, [url, userWalletAddress]);

  if (loading) {
    return <div className="p-4 text-center">Loading server information...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">Error: {error}</div>;
  }

  if (!serverInfo) {
    return <div className="p-4 text-center">No server information available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Server Metadata */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Server Information</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>Name:</div>
          <div>{serverInfo.metadata.name}</div>
          <div>Version:</div>
          <div>{serverInfo.metadata.version}</div>
          {serverInfo.metadata.description && (
            <>
              <div>Description:</div>
              <div>{serverInfo.metadata.description}</div>
            </>
          )}
          <div>Protocol Version:</div>
          <div>{serverInfo.metadata.protocolVersion}</div>
        </div>
      </div>

      {/* Tools */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Available Tools ({serverInfo.toolCount})</h2>
        <div className="space-y-4">
          {serverInfo.tools.map((tool: MCPToolWithPayments) => (
            <div key={tool.name} className="border rounded-lg p-4 space-y-2">
              <h3 className="font-medium">{tool.name}</h3>
              {tool.description && (
                <p className="text-sm text-muted-foreground">{tool.description}</p>
              )}
              
              {/* Pricing Information */}
              {tool.pricing && tool.pricing.length > 0 && (
                <div className="mt-2">
                  <h4 className="text-sm font-medium">Pricing</h4>
                  {tool.pricing.map((price: PricingEntry) => (
                    <div key={price.id} className="text-sm text-muted-foreground">
                      {price.maxAmountRequiredRaw} (decimals: {price.tokenDecimals}) on {price.network}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Capabilities */}
      {serverInfo.metadata.capabilities && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Capabilities</h2>
          <div className="text-sm space-y-1">
            <div>Prompts List Changed: {serverInfo.metadata.capabilities.prompts?.listChanged ? 'Yes' : 'No'}</div>
            <div>Resources Subscribe: {serverInfo.metadata.capabilities.resources?.subscribe ? 'Yes' : 'No'}</div>
            <div>Tools List Changed: {serverInfo.metadata.capabilities.tools?.listChanged ? 'Yes' : 'No'}</div>
          </div>
        </div>
      )}
    </div>
  );
}

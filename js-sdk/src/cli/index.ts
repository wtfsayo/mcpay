#!/usr/bin/env node

import { config } from "dotenv";
import { Command } from "commander";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createServerConnections, ServerType, startStdioServer } from '../server/stdio/start-stdio-server.js';
import { scaffoldServer, listTemplates } from './scaffold.js';

config();

interface ServerOptions {
  urls: string;
  privateKey?: string;
  transport: string;
}

interface ScaffoldOptions {
  template: string;
  name: string;
  directory?: string;
  example?: boolean;
}

const program = new Command();

program
  .name('mcpay')
  .description('MCPay CLI - MCP servers with payment capabilities')
  .version('0.0.2');

program
  .command('scaffold')
  .description('Scaffold a new MCP server from templates')
  .requiredOption('-t, --template <template>', 'Template to use (basic, agent, financialdatasets, pinata, agent-cdp)')
  .requiredOption('-n, --name <name>', 'Name for the new server project')
  .option('-d, --directory <directory>', 'Directory to create the project in (defaults to current directory)')
  .option('-e, --example', 'Use the full example implementation instead of basic template')
  .action(async (options: ScaffoldOptions) => {
    try {
      await scaffoldServer({
        template: options.template,
        name: options.name,
        directory: options.directory,
        useExample: options.example
      });
    } catch (error) {
      console.error('Failed to scaffold server:', error);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List available MCP server templates')
  .action(() => {
    listTemplates();
  });

program
  .command('server')
  .description('Start an MCP stdio server with payment transport')
  .requiredOption('-u, --urls <urls>', 'Comma-separated list of server URLs')
  .option('-k, --private-key <key>', 'Private key for wallet (or set PRIVATE_KEY env var)')
  .option('-t, --transport <type>', 'Transport type (payment, http, sse)', 'payment')
  .action(async (options: ServerOptions) => {
    try {
      const privateKeyString = options.privateKey || process.env.PRIVATE_KEY;
      
      if (!privateKeyString) {
        console.error('Error: Private key is required. Use --private-key or set PRIVATE_KEY environment variable.');
        process.exit(1);
      }

      // Validate and cast to Hex type
      if (!privateKeyString.startsWith('0x') || privateKeyString.length !== 66) {
        console.error('Error: Private key must be a valid hex string starting with 0x and 64 characters long.');
        process.exit(1);
      }

      const privateKey = privateKeyString as Hex;
      const serverUrls = options.urls.split(',').map((url: string) => url.trim());
      
      if (serverUrls.length === 0) {
        console.error('Error: At least one server URL is required.');
        process.exit(1);
      }

      const account = privateKeyToAccount(privateKey);
      
      // Map transport type to ServerType enum
      let serverType: ServerType;
      switch (options.transport.toLowerCase()) {
        case 'payment':
          serverType = ServerType.Payment;
          break;
        case 'sse':
          serverType = ServerType.SSE;
          break;
        case 'http':
        default:
          serverType = ServerType.HTTPStream;
          break;
      }

      console.log(`Starting MCP server with ${options.transport} transport...`);
      console.log(`Connecting to ${serverUrls.length} server(s): ${serverUrls.join(', ')}`);

      const serverConnections = createServerConnections(serverUrls, serverType);
      
      await startStdioServer({
        serverConnections,
        account,
      });

      console.log(`Successfully connected to ${serverUrls.length} servers`);
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  });

program
  .command('proxy')
  .description('Start a proxy server (alias for server command)')
  .requiredOption('-u, --urls <urls>', 'Comma-separated list of server URLs')
  .option('-k, --private-key <key>', 'Private key for wallet (or set PRIVATE_KEY env var)')
  .option('-t, --transport <type>', 'Transport type (payment, http, sse)', 'payment')
  .action(async (options: ServerOptions) => {
    // Duplicate server logic (since it's an alias)
    try {
      const privateKeyString = options.privateKey || process.env.PRIVATE_KEY;
      
      if (!privateKeyString) {
        console.error('Error: Private key is required. Use --private-key or set PRIVATE_KEY environment variable.');
        process.exit(1);
      }

      // Validate and cast to Hex type
      if (!privateKeyString.startsWith('0x') || privateKeyString.length !== 66) {
        console.error('Error: Private key must be a valid hex string starting with 0x and 64 characters long.');
        process.exit(1);
      }

      const privateKey = privateKeyString as Hex;
      const serverUrls = options.urls.split(',').map((url: string) => url.trim());
      
      if (serverUrls.length === 0) {
        console.error('Error: At least one server URL is required.');
        process.exit(1);
      }

      const account = privateKeyToAccount(privateKey);
      
      // Map transport type to ServerType enum
      let serverType: ServerType;
      switch (options.transport.toLowerCase()) {
        case 'payment':
          serverType = ServerType.Payment;
          break;
        case 'sse':
          serverType = ServerType.SSE;
          break;
        case 'http':
        default:
          serverType = ServerType.HTTPStream;
          break;
      }

      console.log(`Starting MCP proxy server with ${options.transport} transport...`);
      console.log(`Connecting to ${serverUrls.length} server(s): ${serverUrls.join(', ')}`);

      const serverConnections = createServerConnections(serverUrls, serverType);
      
      await startStdioServer({
        serverConnections,
        account,
      });

      console.log(`Successfully connected to ${serverUrls.length} servers via proxy`);
    } catch (error) {
      console.error('Failed to start proxy server:', error);
      process.exit(1);
    }
  });

program
  .command('version')
  .description('Show version information')
  .action(() => {
    console.log('mcpay-sdk version 0.0.2');
  });

// Parse command line arguments
program.parse();

// If no command was provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
} 
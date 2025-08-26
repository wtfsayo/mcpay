import * as fs from 'fs/promises';
import * as path from 'path';

interface ScaffoldOptions {
  template: string;
  name: string;
  directory?: string;
  useExample?: boolean;
}

interface TemplateConfig {
  name: string;
  description: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  envVariables: string[];
}

const TEMPLATES: Record<string, TemplateConfig> = {
  basic: {
    name: 'Basic MCP Server',
    description: 'A minimal MCP server with essential dependencies only',
    dependencies: {
      '@modelcontextprotocol/sdk': '^1.12.3',
      '@vercel/mcp-adapter': '^0.11.1',
      'zod': '^3.25.67'
    },
    devDependencies: {
      '@types/node': '^22.13.10'
    },
    scripts: {
      'test': 'echo "Error: no test specified" && exit 1',
      'dev': 'vercel dev',
      'deploy': 'vercel'
    },
    envVariables: ['VALID_KEYS']
  }
};

const basicServerTemplate = `import { createMcpHandler } from "@vercel/mcp-adapter";
import { z } from "zod";

const VALID_KEYS = process.env.VALID_KEYS?.split(",");

const handler = createMcpHandler((server) => { 
  // Add your tools here
  server.tool(
    "exampleTool",
    "Example tool description",
    {
      input: z.string().describe("Input parameter description")
    },
    async ({ input }, { authInfo }) => {
      // Your tool implementation here
      return { content: [{ type: "text", text: \`Hello \${input}!\` }] };
    }
  );
});

const wrappedHandler = async (req: Request) => {
  const apiKey = req.headers.get('x-api-key');
  const isAuthenticated = apiKey && VALID_KEYS?.includes(apiKey);

  // Add auth info to request headers
  const modifiedReq = new Request(req.url, {
    method: req.method,
    headers: {
      ...Object.fromEntries(req.headers),
      'x-auth-status': isAuthenticated ? 'authenticated' : 'unauthenticated'
    },
    body: req.body,
    // @ts-ignore -- 'duplex' required by Node.js 18+ but not in TypeScript types yet
    duplex: 'half'
  });

  return handler(modifiedReq);
};

export { wrappedHandler as GET, wrappedHandler as POST, wrappedHandler as DELETE };
`;

const typescriptConfig = `{
  "compilerOptions": {
    "module": "NodeNext",
    "declaration": true,
    "target": "ES2021",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*", "api/**/*"],
  "exclude": ["node_modules", "**/*.test.ts"]
}
`;

const vercelConfig = `{
  "rewrites": [{ "source": "/(.+)", "destination": "/api/server" }],
  "functions": {
    "api/server.ts": {
      "maxDuration": 800
    }
  }
}
`;

const gitignoreTemplate = `node_modules
.env
.vercel
dist
`;

const indexHtmlTemplate = (serverName: string) => `<h1>${serverName}</h1>

<p>MCP Server - Protocol is mounted at the root.</p>
`;

const readmeTemplate = (name: string, description: string, envVars: string[]) => `# ${name}

${description}

## Setup

1. Install dependencies:
\`\`\`bash
pnpm install
\`\`\`

2. Set up environment variables:
\`\`\`bash
cp env.example .env
\`\`\`

Then edit \`.env\` with your API keys:
${envVars.map(env => `- \`${env}\`: Your ${env.toLowerCase().replace(/_/g, ' ')}`).join('\n')}

## Development

Run locally with Vercel:
\`\`\`bash
vercel dev
\`\`\`

## Deployment

Deploy to Vercel:
\`\`\`bash
vercel
\`\`\`

## Usage

Once deployed, you can use this MCP server with the mcpay CLI:

\`\`\`bash
mcpay server -u https://your-deployment.vercel.app/api/server
\`\`\`
`;

export async function scaffoldServer(options: ScaffoldOptions): Promise<void> {
  const { template, name, directory = process.cwd(), useExample = false } = options;

  if (!TEMPLATES[template]) {
    throw new Error(`Unknown template: ${template}. Available templates: ${Object.keys(TEMPLATES).join(', ')}`);
  }

  const templateConfig = TEMPLATES[template];
  const projectDir = path.join(directory, name);

  try {
    // Check if directory already exists
    try {
      await fs.access(projectDir);
      throw new Error(`Directory ${name} already exists`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Create project directory
    await fs.mkdir(projectDir, { recursive: true });
    
    // Create api directory
    await fs.mkdir(path.join(projectDir, 'api'), { recursive: true });

    // Create public directory
    await fs.mkdir(path.join(projectDir, 'public'), { recursive: true });

    // Create package.json
    const packageJson = {
      name: name,
      version: "1.0.0",
      description: templateConfig.description,
      main: "index.js",
      type: "module",
      scripts: templateConfig.scripts,
      keywords: [],
      author: "",
      license: "ISC",
      dependencies: templateConfig.dependencies,
      devDependencies: templateConfig.devDependencies
    };

    await fs.writeFile(
      path.join(projectDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create server.ts - either from example or basic template
    let serverContent = basicServerTemplate;
    
    if (useExample) {
      try {
        // Try to find the corresponding example directory
        const exampleDirs = ['mcp-examples', '../mcp-examples', '../../mcp-examples'];
        let exampleDir = null;
        
        for (const dir of exampleDirs) {
          try {
            const examplePath = path.join(process.cwd(), dir, template === 'financialdatasets' ? 'financialdatasets.ai' : template);
            await fs.access(examplePath);
            exampleDir = examplePath;
            break;
          } catch {
            continue;
          }
        }
        
        if (exampleDir) {
          const exampleServerPath = path.join(exampleDir, 'api', 'server.ts');
          serverContent = await fs.readFile(exampleServerPath, 'utf-8');
          // console.log(`📄 Using example implementation from ${template}`);
          
          // Also copy additional files if they exist
          const additionalFiles = ['lib', 'scripts'];
          for (const file of additionalFiles) {
            try {
              const sourcePath = path.join(exampleDir, file);
              const destPath = path.join(projectDir, file);
              await copyDirectory(sourcePath, destPath);
              // console.log(`📁 Copied ${file} directory`);
            } catch {
              // File doesn't exist, skip
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️  Could not copy example implementation, using basic template instead`);
      }
    }

    await fs.writeFile(
      path.join(projectDir, 'api', 'server.ts'),
      serverContent
    );

    // Create tsconfig.json
    await fs.writeFile(
      path.join(projectDir, 'tsconfig.json'),
      typescriptConfig
    );

    // Create vercel.json
    await fs.writeFile(
      path.join(projectDir, 'vercel.json'),
      vercelConfig
    );

    // Create .gitignore
    await fs.writeFile(
      path.join(projectDir, '.gitignore'),
      gitignoreTemplate
    );

    // Create public/index.html
    await fs.writeFile(
      path.join(projectDir, 'public', 'index.html'),
      indexHtmlTemplate(templateConfig.name)
    );

    // Create env.example
    const envExample = templateConfig.envVariables.map(env => `${env}=`).join('\n');
    await fs.writeFile(
      path.join(projectDir, 'env.example'),
      envExample
    );

    // Create README.md
    await fs.writeFile(
      path.join(projectDir, 'README.md'),
      readmeTemplate(templateConfig.name, templateConfig.description, templateConfig.envVariables)
    );

    // console.log(`✅ Successfully scaffolded "${templateConfig.name}" project in ${name}/`);
    // console.log('\nNext steps:');
    // console.log(`1. cd ${name}`);
    // console.log('2. pnpm install');
    // console.log('3. cp env.example .env');
    // console.log('4. Edit .env with your API keys');
    // console.log('5. vercel dev');

  } catch (error) {
    // Clean up on error
    try {
      await fs.rmdir(projectDir, { recursive: true });
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    throw error;
  }
}

async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const files = await fs.readdir(src);
  
  for (const file of files) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    const stat = await fs.stat(srcPath);
    
    if (stat.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

export function listTemplates(): void {
  // console.log('Available templates:\n');
  Object.entries(TEMPLATES).forEach(([key, config]) => {
    // console.log(`${key.padEnd(20)} - ${config.name}`);
    // console.log(`${' '.repeat(22)}${config.description}\n`);
  });
} 
export { authRouter }

// apps/api/src/routes/generation.ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../types/env'
import { generateCode } from '../services/ai-service'
import { callV0API } from '../services/v0-service'

const generationRouter = new Hono<{ Bindings: Env }>()

const generateSchema = z.object({
  prompt: z.string().min(10),
  type: z.enum(['component', 'page', 'api', 'fullstack']),
  framework: z.enum(['react', 'vue', 'svelte', 'nextjs']).optional(),
  projectId: z.string().uuid().optional(),
})

// Generate code from prompt
generationRouter.post('/generate',
  zValidator('json', generateSchema),
  async (c) => {
    const { prompt, type, framework = 'react', projectId } = c.req.valid('json')
    const userId = c.get('userId')
    
    try {
      // Check user's generation quota
      const user = await c.env.DB.prepare(
        'SELECT generations_used, generations_limit FROM users WHERE id = ?'
      ).bind(userId).first() as any
      
      if (user.generations_used >= user.generations_limit) {
        return c.json({ 
          error: 'Generation limit reached. Upgrade your plan to continue.' 
        }, 429)
      }
      
      
      // Store generation request
      await c.env.DB.prepare(`
        INSERT INTO generations (id, user_id, project_id, prompt, type, framework, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'processing', ?)
      `).bind(
        generationId,
        userId,
        projectId,
        prompt,
        type,
        framework,
        new Date().toISOString()
      ).run()
      
      let generatedCode: any
      
      // Try v0 API first, fallback to Workers AI
      try {
        generatedCode = await callV0API(prompt, type, framework, c.env)
      } catch (v0Error) {
        console.warn('v0 API failed, using Workers AI fallback:', v0Error)
        generatedCode = await generateCode(prompt, type, framework, c.env)
      }
      
      // Store generated files in R2
      const files = generatedCode.files || []
      const fileUrls = []
      
      for (const file of files) {
        const fileKey = `generations/${generationId}/${file.name}`
        
        await c.env.STORAGE.put(fileKey, file.content, {
          httpMetadata: {
            contentType: file.type || 'text/plain'
          }
        })
        
        fileUrls.push({
          name: file.name,
          url: `https://storage.thisaicodes.com/${fileKey}`,
          type: file.type
        })
      }
      
      // Update generation with results
      await c.env.DB.prepare(`
        UPDATE generations 
        SET status = 'completed', result = ?, files = ?, completed_at = ?
        WHERE id = ?
      `).bind(
        JSON.stringify(generatedCode),
        JSON.stringify(fileUrls),
        new Date().toISOString(),
        generationId
      ).run()
      
      // Increment user's generation count
      await c.env.DB.prepare(
        'UPDATE users SET generations_used = generations_used + 1 WHERE id = ?'
      ).bind(userId).run()
      
      return c.json({
        generationId,
        code: generatedCode,
        files: fileUrls,
        message: 'Code generated successfully'
      })
      
    } catch (error) {
      console.error('Generation error:', error)
      
      // Update generation status to failed
      await c.env.DB.prepare(
        'UPDATE generations SET status = "failed", error = ? WHERE id = ?'
      ).bind(error.message, generationId).run()
      
      return c.json({ error: 'Code generation failed' }, 500)
    }
  }
)

// Get generation history
generationRouter.get('/history', async (c) => {
  const userId = c.get('userId')
  const page = parseInt(c.req.query('page') || '1')
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50)
  const offset = (page - 1) * limit
  
  try {
    const generations = await c.env.DB.prepare(`
      SELECT id, prompt, type, framework, status, created_at, completed_at
      FROM generations 
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all()
    
    const total = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM generations WHERE user_id = ?'
    ).bind(userId).first() as any
    
    return c.json({
      generations: generations.results,
      pagination: {
        page,
        limit,
        total: total.count,
        pages: Math.ceil(total.count / limit)
      }
    })
    
  } catch (error) {
    console.error('Generation history error:', error)
    return c.json({ error: 'Failed to fetch generation history' }, 500)
  }
})

// Get specific generation
generationRouter.get('/:id', async (c) => {
  const generationId = c.req.param('id')
  const userId = c.get('userId')
  
  try {
    const generation = await c.env.DB.prepare(`
      SELECT * FROM generations 
      WHERE id = ? AND user_id = ?
    `).bind(generationId, userId).first()
    
    if (!generation) {
      return c.json({ error: 'Generation not found' }, 404)
    }
    
    return c.json({ generation })
    
  } catch (error) {
    console.error('Get generation error:', error)
    return c.json({ error: 'Failed to fetch generation' }, 500)
  }
})

export { generationRouter }

// apps/api/src/services/ai-service.ts
import type { Env } from '../types/env'

export async function generateCode(
  prompt: string, 
  type: string, 
  framework: string, 
  env: Env
): Promise<any> {
  
  const systemPrompt = `You are an expert full-stack developer. Generate production-ready code based on the user's requirements.

Type: ${type}
Framework: ${framework}

Requirements:
- Write clean, maintainable code
- Include proper error handling
- Add TypeScript types where applicable
- Include basic styling with Tailwind CSS
- Follow best practices and conventions
- Generate complete, working code that can be deployed immediately

Return the response as a JSON object with this structure:
{
  "files": [
    {
      "name": "filename.tsx",
      "content": "file content here",
      "type": "text/tsx"
    }
  ],
  "description": "Brief description of what was generated",
  "instructions": "Setup and deployment instructions"
}`

  try {
    const response = await env.AI.run('@cf/meta/llama-2-7b-chat-fp16', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: 4000,
      temperature: 0.7,
    })
    
    // Parse AI response
    const aiText = response.response
    
    // Extract JSON from response (AI might wrap it in markdown)
    const jsonMatch = aiText.match(/```json\s*([\s\S]*?)\s*```/) || 
                     aiText.match(/\{[\s\S]*\}/)
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1] || jsonMatch[0])
    }
    
    // Fallback: create basic structure
    return {
      files: [
        {
          name: 'component.tsx',
          content: generateFallbackCode(prompt, type, framework),
          type: 'text/tsx'
        }
      ],
      description: 'Basic component generated',
      instructions: 'Install dependencies and run the development server'
    }
    
  } catch (error) {
    console.error('AI generation error:', error)
    throw new Error('AI code generation failed')
  }
}

function generateFallbackCode(prompt: string, type: string, framework: string): string {
  return `// Generated component based on: ${prompt}
import React from 'react'

interface Props {
  // Add your props here
}

export default function GeneratedComponent(props: Props) {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-gray-900">
        Generated Component
      </h1>
      <p className="mt-2 text-gray-600">
        This component was generated based on your prompt: "${prompt}"
      </p>
      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-600">
          Type: {type} | Framework: {framework}
        </p>
      </div>
    </div>
  )
}`
}

// apps/api/src/services/v0-service.ts
import type { Env } from '../types/env'

export async function callV0API(
  prompt: string,
  type: string,
  framework: string,
  env: Env
): Promise<any> {
  
  if (!env.V0_API_KEY) {
    throw new Error('v0 API key not configured')
  }
  
  const requestBody = {
    prompt,
    type,
    framework,
    options: {
      typescript: true,
      styling: 'tailwind',
      responsive: true
    }
  }
  
  try {
    const response = await fetch('https://api.v0.dev/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.V0_API_KEY}`,
        'User-Agent': 'ThisAICodes/1.0'
      },
      body: JSON.stringify(requestBody)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`v0 API error: ${response.status} ${errorText}`)
    }
    
    const result = await response.json()
    
    // Transform v0 response to our format
    return {
      files: result.files?.map((file: any) => ({
        name: file.name,
        content: file.content,
        type: getFileType(file.name)
      })) || [],
      description: result.description || 'Generated with v0',
      instructions: result.instructions || 'Standard React component setup'
    }
    
  } catch (error) {
    console.error('v0 API call failed:', error)
    throw error
  }
}

function getFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const typeMap: { [key: string]: string } = {
    'tsx': 'text/tsx',
    'ts': 'text/typescript',
    'jsx': 'text/jsx',
    'js': 'text/javascript',
    'css': 'text/css',
    'html': 'text/html',
    'json': 'application/json',
    'md': 'text/markdown'
  }
  return typeMap[ext || ''] || 'text/plain'
}

// apps/api/src/services/email-service.ts
import type { Env } from '../types/env'

export async function sendVerificationEmail(
  email: string, 
  token: string, 
  env: Env
): Promise<void> {
  
  const verificationUrl = `https://thisaicodes.com/auth/verify?token=${token}`
  
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #0A0E27 0%, #1A1D3A 100%); padding: 40px; text-align: center;">
        <h1 style="color: #00D4FF; font-size: 32px; margin: 0;">ThisAICodes</h1>
      </div>
      
      <div style="padding: 40px; background: #fff;">
        <h2 style="color: #333; margin-bottom: 20px;">Verify your email address</h2>
        <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
          Welcome to ThisAICodes! Please verify your email address to start building amazing applications with AI.
        </p>
        
        <a href="${verificationUrl}" 
           style="display: inline-block; padding: 15px 30px; background: #00D4FF; color: #000; text-decoration: none; border-radius: 8px; font-weight: bold; margin-bottom: 30px;">
          Verify Email Address
        </a>
        
        <p style="color: #888; font-size: 14px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${verificationUrl}" style="color: #00D4FF;">${verificationUrl}</a>
        </p>
      </div>
      
      <div style="padding: 20px; background: #f8f9fa; text-align: center; color: #666; font-size: 12px;">
        <p>This email was sent by ThisAICodes. If you didn't create an account, you can safely ignore this email.</p>
      </div>
    </div>
  `
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'ThisAICodes <noreply@thisaicodes.com>',
        to: [email],
        subject: 'Verify your ThisAICodes account',
        html: emailHtml
      })
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Email service error: ${error}`)
    }
    
  } catch (error) {
    console.error('Send verification email error:', error)
    throw new Error('Failed to send verification email')
  }
}

export async function sendPasswordResetEmail(
  email: string, 
  token: string, 
  env: Env
): Promise<void> {
  
  const resetUrl = `https://thisaicodes.com/auth/reset-password?token=${token}`
  
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #0A0E27 0%, #1A1D3A 100%); padding: 40px; text-align: center;">
        <h1 style="color: #00D4FF; font-size: 32px; margin: 0;">ThisAICodes</h1>
      </div>
      
      <div style="padding: 40px; background: #fff;">
        <h2 style="color: #333; margin-bottom: 20px;">Reset your password</h2>
        <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
          We received a request to reset your password. Click the button below to create a new password.
        </p>
        
        <a href="${resetUrl}" 
           style="display: inline-block; padding: 15px 30px; background: #00D4FF; color: #000; text-decoration: none; border-radius: 8px; font-weight: bold; margin-bottom: 30px;">
          Reset Password
        </a>
        
        <p style="color: #888; font-size: 14px;">
          This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
        
        <p style="color: #888; font-size: 14px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${resetUrl}" style="color: #00D4FF;">${resetUrl}</a>
        </p>
      </div>
      
      <div style="padding: 20px; background: #f8f9fa; text-align: center; color: #666; font-size: 12px;">
        <p>This email was sent by ThisAICodes.</p>
      </div>
    </div>
  `
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'ThisAICodes <noreply@thisaicodes.com>',
        to: [email],
        subject: 'Reset your ThisAICodes password',
        html: emailHtml
      })
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Email service error: ${error}`)
    }
    
  } catch (error) {
    console.error('Send password reset email error:', error)
    throw new Error('Failed to send password reset email')
  }
}

// apps/api/migrations/0001_initial.sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  email_verified INTEGER DEFAULT 0,
  verification_token TEXT,
  reset_token TEXT,
  reset_token_expires_at TEXT,
  email_verified_at TEXT,
  last_login_at TEXT,
  generations_used INTEGER DEFAULT 0,
  generations_limit INTEGER DEFAULT 3,
  subscription_tier TEXT DEFAULT 'free',
  subscription_id TEXT,
  subscription_status TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  deleted_at TEXT
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  framework TEXT NOT NULL,
  template TEXT,
  repository_url TEXT,
  deployment_url TEXT,
  status TEXT DEFAULT 'active',
  settings TEXT, -- JSON
  created_at TEXT NOT NULL,
  updated_at TEXT,
  deleted_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Generations table
CREATE TABLE IF NOT EXISTS generations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  prompt TEXT NOT NULL,
  type TEXT NOT NULL,
  framework TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  result TEXT, -- JSON
  files TEXT, -- JSON
  error TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users (id),
  FOREIGN KEY (project_id) REFERENCES projects (id)
);

-- Deployments table
CREATE TABLE IF NOT EXISTS deployments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  generation_id TEXT,
  status TEXT DEFAULT 'pending',
  url TEXT,
  domain TEXT,
  branch TEXT DEFAULT 'main',
  commit_hash TEXT,
  build_logs TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects (id),
  FOREIGN KEY (user_id) REFERENCES users (id),
  FOREIGN KEY (generation_id) REFERENCES generations (id)
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  status TEXT NOT NULL,
  tier TEXT NOT NULL,
  current_period_start TEXT,
  current_period_end TEXT,
  cancel_at_period_end INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Analytics table
CREATE TABLE IF NOT EXISTS analytics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  event_type TEXT NOT NULL,
  event_data TEXT, -- JSON
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id),
  FOREIGN KEY (project_id) REFERENCES projects (id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users (verification_token);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users (reset_token);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects (user_id);
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations (user_id);
CREATE INDEX IF NOT EXISTS idx_generations_project_id ON generations (project_id);
CREATE INDEX IF NOT EXISTS idx_deployments_project_id ON deployments (project_id);
CREATE INDEX IF NOT EXISTS idx_deployments_user_id ON deployments (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions (stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics (user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_project_id ON analytics (project_id);

// Setup script: scripts/setup.sh
#!/bin/bash

echo "🔥 Setting up ThisAICodes.com monorepo..."

# Check if required tools are installed
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm is required but not installed. Run: npm install -g pnpm" >&2; exit 1; }

echo "✅ Dependencies check passed"

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Copy environment files
echo "⚙️  Setting up environment files..."
if [ ! -f "apps/web/.env.local" ]; then
  cp apps/web/.env.local.example apps/web/.env.local
  echo "📝 Created apps/web/.env.local - please configure your environment variables"
fi

if [ ! -f "apps/api/.env" ]; then
  cp .env.example apps/api/.env
  echo "📝 Created apps/api/.env - please configure your environment variables"
fi

# Setup database
echo "🗄️  Setting up database..."
cd apps/api
pnpm run db:local
pnpm run migrate

# Build packages
echo "🏗️  Building packages..."
cd ../../
pnpm run build

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Configure your environment variables in:"
echo "   - apps/web/.env.local"
echo "   - apps/api/.env"
echo ""
echo "2. Start development servers:"
echo "   pnpm run dev"
echo ""
echo "3. Visit http://localhost:3000 to see your app"
echo ""
echo "🚀 Happy coding with ThisAICodes!"
      // apps/web/package.json
{
  "name": "@thisaicodes/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "next": "14.0.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-toast": "^1.1.5",
    "framer-motion": "^10.16.16",
    "lucide-react": "^0.300.0",
    "@monaco-editor/react": "^4.6.0",
    "react-hook-form": "^7.48.2",
    "zod": "^3.22.4",
    "@hookform/resolvers": "^3.3.2",
    "tailwindcss": "^3.3.6",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.2.0",
    "stripe": "^14.9.0",
    "@stripe/stripe-js": "^2.4.0",
    "@thisaicodes/ui": "workspace:*",
    "@thisaicodes/auth": "workspace:*",
    "@thisaicodes/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20.10.5",
    "@types/react": "^18.2.45",
    "@types/react-dom": "^18.2.18",
    "typescript": "^5.3.3",
    "eslint": "^8.56.0",
    "eslint-config-next": "14.0.4",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32"
  }
}

// apps/web/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['thisaicodes.com', 'cdn.thisaicodes.com'],
  },
  env: {
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
  },
}

module.exports = nextConfig

// apps/web/tailwind.config.js
const { fontFamily } = require("tailwindcss/defaultTheme")

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Cyberpunk theme colors
        neon: {
          blue: "#00D4FF",
          cyan: "#00FFFF",
          pink: "#FF0080",
          purple: "#8B00FF",
          green: "#39FF14",
          orange: "#FF6B35",
        },
        dark: {
          bg: "#0A0E27",
          surface: "#1A1D3A",
          border: "#2A2D4A",
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)", ...fontFamily.sans],
        mono: ["var(--font-mono)", ...fontFamily.mono],
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "glitch": {
          "0%, 100%": { transform: "translateX(0)" },
          "10%": { transform: "translateX(-2px)" },
          "20%": { transform: "translateX(2px)" },
          "30%": { transform: "translateX(-2px)" },
          "40%": { transform: "translateX(2px)" },
          "50%": { transform: "translateX(-2px)" },
        },
        "neon-pulse": {
          "0%, 100%": { 
            textShadow: "0 0 5px currentColor, 0 0 10px currentColor, 0 0 15px currentColor" 
          },
          "50%": { 
            textShadow: "0 0 2px currentColor, 0 0 5px currentColor, 0 0 8px currentColor" 
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "glitch": "glitch 0.5s ease-in-out infinite",
        "neon-pulse": "neon-pulse 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

// apps/web/app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { AuthProvider } from '@/lib/providers/auth-provider'
import { ToastProvider } from '@/lib/providers/toast-provider'
import { ThemeProvider } from '@/lib/providers/theme-provider'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-sans',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'ThisAICodes - AI-Powered Web Development',
  description: 'Build full-stack applications with AI assistance. Deploy, scale, and monetize your projects instantly.',
  keywords: ['AI', 'web development', 'full-stack', 'automation', 'deployment'],
  authors: [{ name: 'ThisAICodes' }],
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#00D4FF',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans bg-dark-bg text-white`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <AuthProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

// apps/web/app/globals.css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  --popover: 222.2 84% 4.9%;
  --popover-foreground: 210 40% 98%;
  --primary: 217.2 91.2% 59.8%;
  --primary-foreground: 222.2 84% 4.9%;
  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  --accent: 217.2 32.6% 17.5%;
  --accent-foreground: 210 40% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 210 40% 98%;
  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 224.3 76.3% 94.1%;
  --radius: 0.5rem;
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

@layer components {
  .neon-glow {
    @apply text-neon-cyan;
    text-shadow: 
      0 0 5px theme('colors.neon.cyan'),
      0 0 10px theme('colors.neon.cyan'),
      0 0 15px theme('colors.neon.cyan');
  }
  
  .cyberpunk-border {
    background: linear-gradient(45deg, transparent, theme('colors.neon.cyan'), transparent);
    padding: 1px;
  }
  
  .cyberpunk-border > * {
    @apply bg-dark-surface;
  }
  
  .glitch-text {
    position: relative;
  }
  
  .glitch-text::before,
  .glitch-text::after {
    content: attr(data-text);
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
  
  .glitch-text::before {
    animation: glitch 0.3s infinite;
    color: theme('colors.neon.pink');
    z-index: -1;
  }
  
  .glitch-text::after {
    animation: glitch 0.3s infinite;
    color: theme('colors.neon.cyan');
    z-index: -2;
  }
}

// apps/web/app/page.tsx
import { HeroSection } from '@/components/marketing/hero-section'
import { FeaturesSection } from '@/components/marketing/features-section'
import { PricingSection } from '@/components/marketing/pricing-section'
import { TestimonialsSection } from '@/components/marketing/testimonials'
import { CTASection } from '@/components/marketing/cta-section'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-dark-bg">
      <Header />
      <main>
        <HeroSection />
        <FeaturesSection />
        <PricingSection />
        <TestimonialsSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  )
}

// apps/web/components/marketing/hero-section.tsx
'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ArrowRight, Code, Zap, Rocket } from 'lucide-react'
import Link from 'next/link'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden py-20 px-4 sm:px-6 lg:px-8">
      {/* Animated background grid */}
      <div className="absolute inset-0 bg-gradient-to-br from-dark-bg via-dark-surface to-dark-bg opacity-50" />
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 212, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 212, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }}
      />
      
      <div className="relative max-w-7xl mx-auto">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <h1 className="text-6xl md:text-8xl font-bold mb-6">
              <span className="neon-glow">This</span>
              <span className="text-white">AI</span>
              <span className="neon-glow">Codes</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              The ultimate AI-powered development platform that transforms your ideas into 
              <span className="text-neon-cyan font-semibold"> production-ready applications</span> 
              in seconds.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
          >
            <Link href="/auth/register">
              <Button size="lg" className="bg-neon-cyan text-black hover:bg-neon-cyan/80 px-8 py-4 text-lg font-semibold">
                Start Building <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/demo">
              <Button size="lg" variant="outline" className="border-neon-cyan text-neon-cyan hover:bg-neon-cyan/10 px-8 py-4 text-lg">
                Watch Demo
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto"
          >
            <div className="cyberpunk-border rounded-lg p-6">
              <div className="bg-dark-surface rounded-lg p-6">
                <Code className="h-12 w-12 text-neon-cyan mb-4 mx-auto" />
                <h3 className="text-xl font-semibold mb-2">AI Code Generation</h3>
                <p className="text-gray-400">
                  Transform natural language into production-ready full-stack applications
                </p>
              </div>
            </div>
            
            <div className="cyberpunk-border rounded-lg p-6">
              <div className="bg-dark-surface rounded-lg p-6">
                <Zap className="h-12 w-12 text-neon-green mb-4 mx-auto" />
                <h3 className="text-xl font-semibold mb-2">Instant Deployment</h3>
                <p className="text-gray-400">
                  Deploy to Cloudflare Workers with custom domains and SSL in one click
                </p>
              </div>
            </div>
            
            <div className="cyberpunk-border rounded-lg p-6">
              <div className="bg-dark-surface rounded-lg p-6">
                <Rocket className="h-12 w-12 text-neon-purple mb-4 mx-auto" />
                <h3 className="text-xl font-semibold mb-2">Scale & Monetize</h3>
                <p className="text-gray-400">
                  Built-in Stripe integration and analytics to grow your applications
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// apps/api/package.json
{
  "name": "@thisaicodes/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "build": "tsc",
    "migrate": "wrangler d1 migrations apply thisaicodes-db",
    "db:local": "wrangler d1 execute thisaicodes-db --local --file=./migrations/schema.sql"
  },
  "dependencies": {
    "hono": "^3.12.0",
    "@hono/zod-validator": "^0.2.1",
    "zod": "^3.22.4",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "stripe": "^14.9.0",
    "@thisaicodes/database": "workspace:*",
    "@thisaicodes/auth": "workspace:*",
    "@thisaicodes/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.5",
    "@cloudflare/workers-types": "^4.20231218.0",
    "typescript": "^5.3.3",
    "wrangler": "^3.19.0"
  }
}

// apps/api/wrangler.toml
name = "thisaicodes-api"
main = "src/index.ts"
compatibility_date = "2023-12-01"

[env.development]
name = "thisaicodes-api-dev"

[env.production]
name = "thisaicodes-api-prod"

[[d1_databases]]
binding = "DB"
database_name = "thisaicodes-db"
database_id = "your-database-id"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "thisaicodes-storage"

[ai]
binding = "AI"

[vars]
ENVIRONMENT = "development"
JWT_SECRET = "your-jwt-secret"
STRIPE_WEBHOOK_SECRET = "your-stripe-webhook-secret"
V0_API_KEY = "your-v0-api-key"
RESEND_API_KEY = "your-resend-api-key"

// apps/api/src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { authRouter } from './routes/auth'
import { projectsRouter } from './routes/projects'
import { generationRouter } from './routes/generation'
import { deploymentRouter } from './routes/deployment'
import { billingRouter } from './routes/billing'
import { analyticsRouter } from './routes/analytics'
import { authMiddleware } from './middleware/auth'
import { errorHandler } from './middleware/error-handler'
import type { Env } from './types/env'

const app = new Hono<{ Bindings: Env }>()

// Global middleware
app.use('*', logger())
app.use('*', prettyJSON())
app.use('*', cors({
  origin: ['http://localhost:3000', 'https://thisaicodes.com', 'https://*.thisaicodes.com'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}))

// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT 
  })
})

// API routes
app.route('/auth', authRouter)
app.route('/projects', projectsRouter)
app.route('/generation', generationRouter)
app.route('/deployment', deploymentRouter)
app.route('/billing', billingRouter)
app.route('/analytics', analyticsRouter)

// Protected routes require authentication
app.use('/projects/*', authMiddleware)
app.use('/generation/*', authMiddleware)
app.use('/deployment/*', authMiddleware)
app.use('/analytics/*', authMiddleware)

// Global error handling
app.onError(errorHandler)

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Route not found' }, 404)
})

export default app

// apps/api/src/routes/auth.ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { Env } from '../types/env'
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email-service'
import { rateLimitMiddleware } from '../middleware/rate-limit'

const authRouter = new Hono<{ Bindings: Env }>()

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const verifyEmailSchema = z.object({
  token: z.string(),
})

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
})

// Register endpoint
authRouter.post('/register', 
  rateLimitMiddleware({ limit: 5, window: 900 }), // 5 requests per 15 minutes
  zValidator('json', registerSchema),
  async (c) => {
    const { email, password, name } = c.req.valid('json')
    
    try {
      // Check if user already exists
      const existingUser = await c.env.DB.prepare(
        'SELECT id FROM users WHERE email = ?'
      ).bind(email).first()
      
      if (existingUser) {
        return c.json({ error: 'User already exists' }, 400)
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12)
      
      // Generate email verification token
      const verificationToken = crypto.randomUUID()
      
      // Create user
      const result = await c.env.DB.prepare(`
        INSERT INTO users (id, email, password_hash, name, verification_token, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        email,
        hashedPassword,
        name,
        verificationToken,
        new Date().toISOString()
      ).run()
      
      if (!result.success) {
        throw new Error('Failed to create user')
      }
      
      // Send verification email
      await sendVerificationEmail(email, verificationToken, c.env)
      
      return c.json({ 
        message: 'Registration successful. Please check your email to verify your account.',
        userId: result.meta.last_row_id 
      })
      
    } catch (error) {
      console.error('Registration error:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }
  }
)

// Login endpoint
authRouter.post('/login',
  rateLimitMiddleware({ limit: 10, window: 900 }), // 10 requests per 15 minutes
  zValidator('json', loginSchema),
  async (c) => {
    const { email, password } = c.req.valid('json')
    
    try {
      // Get user
      const user = await c.env.DB.prepare(`
        SELECT id, email, password_hash, name, email_verified, created_at
        FROM users WHERE email = ? AND deleted_at IS NULL
      `).bind(email).first() as any
      
      if (!user) {
        return c.json({ error: 'Invalid credentials' }, 401)
      }
      
      // Verify password
      const validPassword = await bcrypt.compare(password, user.password_hash)
      if (!validPassword) {
        return c.json({ error: 'Invalid credentials' }, 401)
      }
      
      // Check if email is verified
      if (!user.email_verified) {
        return c.json({ error: 'Please verify your email before logging in' }, 403)
      }
      
      // Generate JWT
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email,
          name: user.name 
        },
        c.env.JWT_SECRET,
        { expiresIn: '7d' }
      )
      
      // Update last login
      await c.env.DB.prepare(
        'UPDATE users SET last_login_at = ? WHERE id = ?'
      ).bind(new Date().toISOString(), user.id).run()
      
      return c.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.created_at
        }
      })
      
    } catch (error) {
      console.error('Login error:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }
  }
)

// Verify email endpoint
authRouter.post('/verify-email',
  zValidator('json', verifyEmailSchema),
  async (c) => {
    const { token } = c.req.valid('json')
    
    try {
      const user = await c.env.DB.prepare(
        'SELECT id FROM users WHERE verification_token = ? AND email_verified = 0'
      ).bind(token).first()
      
      if (!user) {
        return c.json({ error: 'Invalid or expired verification token' }, 400)
      }
      
      // Mark email as verified
      await c.env.DB.prepare(`
        UPDATE users 
        SET email_verified = 1, verification_token = NULL, email_verified_at = ?
        WHERE id = ?
      `).bind(new Date().toISOString(), user.id).run()
      
      return c.json({ message: 'Email verified successfully' })
      
    } catch (error) {
      console.error('Email verification error:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }
  }
)

export { authRouter }
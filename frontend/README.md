# MCPay.fun Frontend

This directory contains the frontend application for MCPay.fun, built with [Next.js](https://nextjs.org).

## Overview

The frontend provides the user interface for [TODO: Briefly describe the main features of the frontend, e.g., interacting with MCPay services, viewing payment history, managing account settings, etc.].

## Getting Started

First, ensure you are in the `frontend` directory:

```sh
cd frontend
```

Then, run the development server:

```bash
pnpm dev
# or
npm run dev
# or
yarn dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

You can start editing the main page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a font family from Vercel.

## Key Technologies

- [Next.js](https://nextjs.org/docs)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) (if used, check `postcss.config.mjs` and `tailwind.config.js`)
- [Shadcn/ui](https://ui.shadcn.com/) (if used, check `components.json`)

## Environment Variables

If your frontend requires environment variables (e.g., API endpoints), create a `.env.local` file in the `frontend` directory:

```env
NEXT_PUBLIC_API_BASE_URL="http://localhost:8000/api" # Example
```
[TODO: List any relevant frontend-specific environment variables and their purpose.]

## Learn More about Next.js

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

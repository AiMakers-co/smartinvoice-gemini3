# AI Agent Instructions — SmartInvoice

## About This Repository

This is the public repository for **SmartInvoice**, built for the Google DeepMind Gemini 3 Hackathon.

- **Live Demo**: https://www.smartinvoice.finance/
- **Hackathon**: Gemini 3 Hackathon (Devpost, Feb 2026)

## Repository Structure

| Path | Purpose |
|------|---------|
| `src/` | Next.js 16 frontend (React 19, Tailwind CSS 4) |
| `functions/src/config/` | Gemini 3 model configuration and client setup |
| `public/` | Static assets, logos, screenshots |
| `ARCHITECTURE.md` | System architecture and design |
| `README.md` | Project overview and Gemini 3 integration details |

## AI Provider

All AI features use **Google Gemini 3 Flash** via the `@google/genai` SDK. Key capabilities:

- **Multimodal vision** — PDF, image, CSV, Excel processing
- **Structured output** — `responseMimeType: "application/json"`
- **Thinking/reasoning** — Configurable `ThinkingLevel.LOW` and `ThinkingLevel.HIGH`
- **Function calling** — 8 custom tools for agentic reconciliation

## Development

```bash
npm install && cd functions && npm install
cp .env.example .env.local
npm run dev
```

## Team

Built by [AiMakers](https://github.com/AiMakers-co).

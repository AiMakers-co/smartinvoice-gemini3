# Source Code

The implementation source code for SmartInvoice Cloud Functions is proprietary and not included in this public repository.

## What's Included

- `config/ai-models.ts` - Gemini 3 model configuration and pricing (non-sensitive)

## What's Not Included

The following modules contain proprietary business logic:

| Module | Description |
|--------|-------------|
| `bank-statements/` | Document extraction prompts and parsing logic |
| `ai-assistant/` | Conversational AI implementation |
| `reconciliation/` | Agentic matching algorithms and tool definitions |
| `stripe/` | Payment processing |
| `admin/` | Internal administration tools |

## Architecture Overview

See the parent [README.md](../README.md) for architecture diagrams and Gemini 3 integration details.

## Licensing

All code in this repository is proprietary. See [LICENSE](../../LICENSE) for terms.

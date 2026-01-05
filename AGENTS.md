This file provides guidance to LLM agents when working with this repository.

## Maintenance Instructions

This file should be committed to the repository and kept up to date. When making significant changes to the project structure, dependencies, or development workflows, update this file accordingly. Do not include local-specific information (paths, credentials, personal settings, or references to specific LLM agents).

## Project Overview

This is an SFTP service for Permanent.org that implements the SFTP protocol to support interaction with the Permanent API. It allows users to upload and download files from their Permanent.org archives using standard SFTP clients like rclone.

## Tech Stack

- **Runtime**: Node.js 24.x
- **Language**: TypeScript 5.x
- **SFTP Protocol**: ssh2
- **Authentication**: FusionAuth
- **API Integration**: @permanentorg/sdk
- **Logging**: Winston
- **Error Monitoring**: Sentry
- **Testing**: Jest with ts-jest
- **Linting**: ESLint (eslint-config-love) with Prettier

## Project Structure

```
src/
├── classes/           # Core service classes
│   ├── AuthenticationSession.ts    # User authentication session management
│   ├── AuthTokenManager.ts         # OAuth token refresh handling
│   ├── PermanentFileSystem.ts      # File system operations via Permanent API
│   ├── PermanentFileSystemManager.ts # Manages file system instances
│   ├── SftpSessionHandler.ts       # SFTP protocol session handling
│   ├── SshConnectionHandler.ts     # SSH connection management
│   ├── SshSessionHandler.ts        # SSH session handling
│   └── TemporaryFileManager.ts     # Temp file management for uploads
├── errors/            # Custom error classes
├── utils/             # Utility functions for file attributes and entries
├── fusionAuth.ts      # FusionAuth client configuration
├── index.ts           # Application entry point
├── instrument.ts      # Sentry instrumentation
├── logger.ts          # Winston logger configuration
└── server.ts          # SSH server setup
```

## Common Commands

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the service
npm start

# Start development server (with hot reload)
npm run dev

# Run tests
npm test

# Lint the codebase
npm run lint

# Format code
npm run format
```

## Development Setup

1. Install dependencies: `npm install`
2. Generate a host key: `ssh-keygen -f ./keys/host.key -t ed25519 -N ""`
3. Copy and configure environment: `cp .env.example .env`
4. Start development server: `npm run dev`

## Environment Variables

Key environment variables (see `.env.example` for full list):

- `SSH_PORT` / `SSH_HOST` - Server binding configuration
- `SSH_HOST_KEY_PATH` - Path to SSH host key
- `PERMANENT_API_BASE_PATH` - Permanent API endpoint
- `STELA_API_BASE_PATH` - Stela API v2 endpoint
- `FUSION_AUTH_*` - FusionAuth authentication configuration
- `SENTRY_DSN` / `SENTRY_ENVIRONMENT` - Error monitoring

## Workflow Requirements

After making code changes, always run:

```bash
npm run format   # Auto-fix formatting issues
npm run lint     # Check for linting errors
npm test         # Run tests
```

## Code Style

- No default exports (ESLint rule `import/no-default-export`)
- Import ordering enforced (builtin, external, internal, parent, sibling, index, object, type)
- Prettier for formatting
- TypeScript strict mode enabled

## Testing

Tests use Jest with ts-jest preset. Test files should be named `*.test.ts` and placed alongside the source files they test.

```bash
npm test
```

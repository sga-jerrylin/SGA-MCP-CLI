import * as readline from 'node:readline/promises';

import type { ChatConfig } from './chat-types';
import { ChatSession } from './chat-session';

export async function startChatLoop(config: ChatConfig): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const session = new ChatSession(config);

  console.log('mcp-claw v0.2.0 - AI-powered MCP Server Generator');
  console.log('Type your request in natural language. Ctrl+C to exit.\n');

  const handleSigint = () => {
    rl.close();
    process.exit(0);
  };
  process.on('SIGINT', handleSigint);

  try {
    while (true) {
      const input = await rl.question('> ');
      if (!input.trim()) {
        continue;
      }
      await session.send(input);
    }
  } finally {
    process.off('SIGINT', handleSigint);
    rl.close();
  }
}


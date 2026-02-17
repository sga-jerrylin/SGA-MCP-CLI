export interface ComposeService {
  name: string;
  image: string;
  port: number;
}

export function renderCompose(services: ComposeService[]): string {
  const lines = ['version: "3.9"', 'services:'];

  for (const service of services) {
    lines.push(`  ${service.name}:`);
    lines.push(`    image: ${service.image}`);
    lines.push(`    ports: ["${service.port}:${service.port}"]`);
  }

  return `${lines.join('\n')}\n`;
}

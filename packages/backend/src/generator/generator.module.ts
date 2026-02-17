import { Module } from '@nestjs/common';
import { McpClawCore } from '@mcp-claw/core';
import { GeneratorController } from './generator.controller';
import { GeneratorService } from './generator.service';

@Module({
  controllers: [GeneratorController],
  providers: [
    GeneratorService,
    {
      provide: McpClawCore,
      useValue: {
        generate: async () => ({
          archivePath: '',
          manifestPath: '',
          sbomPath: '',
          signaturePath: ''
        })
      }
    }
  ]
})
export class GeneratorModule {}

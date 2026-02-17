import { z } from 'zod';

export const AuthTypeZ = z.enum(['none', 'bearer', 'api-key', 'oauth2', 'hmac']);

export const IrParamSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  required: z.boolean(),
  description: z.string().optional()
});

export const IrToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  method: z.string().min(1),
  path: z.string().min(1),
  needsConfirmation: z.boolean(),
  isAsync: z.boolean(),
  params: z.array(IrParamSchema)
});

export const IrSchema = z.object({
  system: z.object({
    code: z.string().min(1),
    baseUrl: z.string().url(),
    authType: AuthTypeZ
  }),
  tools: z.array(IrToolSchema)
});

export type IrInput = z.infer<typeof IrSchema>;

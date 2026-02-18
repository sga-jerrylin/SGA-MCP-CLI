"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IrSchema = exports.IrToolSchema = exports.IrParamSchema = exports.AuthTypeZ = void 0;
const zod_1 = require("zod");
exports.AuthTypeZ = zod_1.z.enum(['none', 'bearer', 'api-key', 'oauth2', 'hmac']);
exports.IrParamSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    type: zod_1.z.string().min(1),
    required: zod_1.z.boolean(),
    description: zod_1.z.string().optional()
});
exports.IrToolSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().min(1),
    method: zod_1.z.string().min(1),
    path: zod_1.z.string().min(1),
    needsConfirmation: zod_1.z.boolean(),
    isAsync: zod_1.z.boolean(),
    params: zod_1.z.array(exports.IrParamSchema)
});
exports.IrSchema = zod_1.z.object({
    system: zod_1.z.object({
        code: zod_1.z.string().min(1),
        baseUrl: zod_1.z.string().url(),
        authType: exports.AuthTypeZ
    }),
    tools: zod_1.z.array(exports.IrToolSchema)
});
//# sourceMappingURL=ir.zod.js.map
import { z } from 'zod';
export declare const AuthTypeZ: z.ZodEnum<["none", "bearer", "api-key", "oauth2", "hmac"]>;
export declare const IrParamSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodString;
    required: z.ZodBoolean;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    type: string;
    required: boolean;
    description?: string | undefined;
}, {
    name: string;
    type: string;
    required: boolean;
    description?: string | undefined;
}>;
export declare const IrToolSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    method: z.ZodString;
    path: z.ZodString;
    needsConfirmation: z.ZodBoolean;
    isAsync: z.ZodBoolean;
    params: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodString;
        required: z.ZodBoolean;
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        type: string;
        required: boolean;
        description?: string | undefined;
    }, {
        name: string;
        type: string;
        required: boolean;
        description?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    params: {
        name: string;
        type: string;
        required: boolean;
        description?: string | undefined;
    }[];
    path: string;
    description: string;
    method: string;
    needsConfirmation: boolean;
    isAsync: boolean;
}, {
    name: string;
    params: {
        name: string;
        type: string;
        required: boolean;
        description?: string | undefined;
    }[];
    path: string;
    description: string;
    method: string;
    needsConfirmation: boolean;
    isAsync: boolean;
}>;
export declare const IrSchema: z.ZodObject<{
    system: z.ZodObject<{
        code: z.ZodString;
        baseUrl: z.ZodString;
        authType: z.ZodEnum<["none", "bearer", "api-key", "oauth2", "hmac"]>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        baseUrl: string;
        authType: "none" | "bearer" | "api-key" | "oauth2" | "hmac";
    }, {
        code: string;
        baseUrl: string;
        authType: "none" | "bearer" | "api-key" | "oauth2" | "hmac";
    }>;
    tools: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        method: z.ZodString;
        path: z.ZodString;
        needsConfirmation: z.ZodBoolean;
        isAsync: z.ZodBoolean;
        params: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            type: z.ZodString;
            required: z.ZodBoolean;
            description: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            type: string;
            required: boolean;
            description?: string | undefined;
        }, {
            name: string;
            type: string;
            required: boolean;
            description?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        name: string;
        params: {
            name: string;
            type: string;
            required: boolean;
            description?: string | undefined;
        }[];
        path: string;
        description: string;
        method: string;
        needsConfirmation: boolean;
        isAsync: boolean;
    }, {
        name: string;
        params: {
            name: string;
            type: string;
            required: boolean;
            description?: string | undefined;
        }[];
        path: string;
        description: string;
        method: string;
        needsConfirmation: boolean;
        isAsync: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    system: {
        code: string;
        baseUrl: string;
        authType: "none" | "bearer" | "api-key" | "oauth2" | "hmac";
    };
    tools: {
        name: string;
        params: {
            name: string;
            type: string;
            required: boolean;
            description?: string | undefined;
        }[];
        path: string;
        description: string;
        method: string;
        needsConfirmation: boolean;
        isAsync: boolean;
    }[];
}, {
    system: {
        code: string;
        baseUrl: string;
        authType: "none" | "bearer" | "api-key" | "oauth2" | "hmac";
    };
    tools: {
        name: string;
        params: {
            name: string;
            type: string;
            required: boolean;
            description?: string | undefined;
        }[];
        path: string;
        description: string;
        method: string;
        needsConfirmation: boolean;
        isAsync: boolean;
    }[];
}>;
export type IrInput = z.infer<typeof IrSchema>;

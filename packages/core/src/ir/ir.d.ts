export type AuthType = 'none' | 'bearer' | 'api-key' | 'oauth2' | 'hmac';
export interface IrParam {
    name: string;
    type: string;
    required: boolean;
    description?: string;
}
export interface IrTool {
    name: string;
    description: string;
    method: string;
    path: string;
    needsConfirmation: boolean;
    isAsync: boolean;
    params: IrParam[];
}
export interface IrSystem {
    code: string;
    baseUrl: string;
    authType: AuthType;
}
export interface IR {
    system: IrSystem;
    tools: IrTool[];
}
export declare function cloneIR(ir: IR): IR;

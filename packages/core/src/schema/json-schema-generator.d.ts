import type { IrParam } from '../ir/ir';
export declare function buildObjectSchema(params: IrParam[]): {
    type: string;
    properties: {
        [k: string]: {
            type: string;
        };
    };
    required: string[];
    additionalProperties: boolean;
};

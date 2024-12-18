declare module "onnxruntime-node" {
    export class Tensor {
        constructor(
            type: "string" | "float32" | "int32",
            data: any,
            dims: number[]
        );
        data: any;
    }

    export class InferenceSession {
        static create(modelPath: string): Promise<InferenceSession>;
        run(feeds: {
            [key: string]: Tensor;
        }): Promise<{ [key: string]: Tensor }>;
        release(): Promise<void>;
    }
}

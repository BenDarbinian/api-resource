type AnyResource = Resource<any, any>;
type ResourceConstructor = new () => AnyResource;

export abstract class Resource<Input, Output = unknown> {
    abstract transform(data: Input): Output;

    static make<T extends ResourceConstructor>(
        this: T,
        data: Parameters<InstanceType<T>['transform']>[0],
    ): ReturnType<InstanceType<T>['transform']> {
        const instance = new this();

        return instance.transform(data) as ReturnType<
            InstanceType<T>['transform']
        >;
    }

    static collection<T extends ResourceConstructor>(
        this: T,
        data: Parameters<InstanceType<T>['transform']>[0][],
    ): ReturnType<InstanceType<T>['transform']>[] {
        const instance = new this();

        return data.map(
            item =>
                instance.transform(item) as ReturnType<
                    InstanceType<T>['transform']
                >,
        );
    }
}
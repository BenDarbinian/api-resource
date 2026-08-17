type ResourceConstructor = new (data: any) => Resource;

export abstract class Resource {
    /** Creates a concrete resource from one domain value. */
    static make<T extends ResourceConstructor>(
        this: T,
        data: ConstructorParameters<T>[0],
    ): InstanceType<T> {
        return new this(data) as InstanceType<T>;
    }

    /** Creates a separate concrete resource for every domain value. */
    static collection<T extends ResourceConstructor>(
        this: T,
        data: ConstructorParameters<T>[0][],
    ): InstanceType<T>[] {
        return data.map(item => new this(item) as InstanceType<T>);
    }
}

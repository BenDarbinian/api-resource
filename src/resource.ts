type ResourceConstructor = new (data: any) => Resource;

export type PaginationInput = {
    page: number;
    limit: number;
    total: number;
};

export type PaginationState = PaginationInput & {
    pages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
};

export type DefaultPaginationMeta = {
    page: number;
    limit: number;
    total: number;
    pages: number;
};

export type PaginationMetaFactory<Meta extends object> = (
    state: PaginationState,
) => Meta;

export type PaginationLinksFactory<Links extends object> = (
    state: PaginationState,
) => Links;

export type PaginationConfig<
    Meta extends object = object,
    Links extends object = object,
> = {
    meta?: PaginationMetaFactory<Meta>;
    links?: PaginationLinksFactory<Links>;
};

type ResolvedPaginationConfig<
    Meta extends object = DefaultPaginationMeta,
    Links extends object = never,
> = {
    meta: PaginationMetaFactory<Meta>;
    links?: PaginationLinksFactory<Links>;
};

type AnyResolvedPaginationConfig = ResolvedPaginationConfig<object, object>;

type PaginationMetaOf<Config> =
    Config extends {
        meta: (state: PaginationState) => infer Meta extends object;
    }
        ? Meta
        : DefaultPaginationMeta;

type PaginationLinksOf<Config> =
    Config extends {
        links?: (state: PaginationState) => infer Links extends object;
    }
        ? Links
        : never;

type MergePaginationConfig<
    Base extends AnyResolvedPaginationConfig,
    Override extends PaginationConfig,
> = ResolvedPaginationConfig<
    Override extends {
        meta: (state: PaginationState) => infer Meta extends object;
    }
        ? Meta
        : PaginationMetaOf<Base>,
    Override extends {
        links: (state: PaginationState) => infer Links extends object;
    }
        ? Links
        : PaginationLinksOf<Base>
>;

type PaginationConfigOf<T> =
    T extends { readonly paginationConfig: infer Config }
        ? Config extends AnyResolvedPaginationConfig
            ? Config
            : ResolvedPaginationConfig
        : ResolvedPaginationConfig;

type ConfiguredResourceConstructor<
    Config extends AnyResolvedPaginationConfig,
> = typeof Resource & {
    readonly paginationConfig: Config;
};

type WithoutPaginationKeyConflicts<
    BaseMeta extends object,
    ExtraMeta extends object,
> = ExtraMeta & Record<Extract<keyof ExtraMeta, keyof BaseMeta>, never>;

type MergeMeta<BaseMeta extends object, ExtraMeta extends object> =
    [keyof ExtraMeta] extends [never] ? BaseMeta : BaseMeta & ExtraMeta;

export type PaginatedResponse<
    ResourceType extends Resource,
    BaseMeta extends object,
    Links extends object = never,
    ExtraMeta extends object = {},
> = [Links] extends [never]
    ? {
          data: ResourceType[];
          meta: MergeMeta<BaseMeta, ExtraMeta>;
      }
    : {
          data: ResourceType[];
          meta: MergeMeta<BaseMeta, ExtraMeta>;
          links: Links;
      };

const defaultPaginationConfig: ResolvedPaginationConfig = {
    meta: state => ({
        page: state.page,
        limit: state.limit,
        total: state.total,
        pages: state.pages,
    }),
};

export abstract class Resource {
    static readonly paginationConfig: unknown = defaultPaginationConfig;

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

    /** Creates a paginated response from the concrete resource collection. */
    static paginate<
        T extends ResourceConstructor,
        ExtraMeta extends object = {},
    >(
        this: T,
        data: ConstructorParameters<T>[0][],
        pagination: PaginationInput,
        extraMeta?: ExtraMeta &
            WithoutPaginationKeyConflicts<
                PaginationMetaOf<PaginationConfigOf<T>>,
                ExtraMeta
            >,
    ): PaginatedResponse<
        InstanceType<T>,
        PaginationMetaOf<PaginationConfigOf<T>>,
        PaginationLinksOf<PaginationConfigOf<T>>,
        ExtraMeta
    > {
        const pages = Math.ceil(pagination.total / pagination.limit);
        const state: PaginationState = {
            ...pagination,
            pages,
            hasPreviousPage: pagination.page > 1,
            hasNextPage: pagination.page < pages,
        };
        const configuredResource = this as T & {
            readonly paginationConfig: PaginationConfigOf<T>;
        };
        const response = {
            data: data.map(item => new this(item) as InstanceType<T>),
            meta: {
                ...configuredResource.paginationConfig.meta(state),
                ...(extraMeta ?? {}),
            },
        };

        if (configuredResource.paginationConfig.links) {
            return {
                ...response,
                links: configuredResource.paginationConfig.links(state),
            } as unknown as PaginatedResponse<
                InstanceType<T>,
                PaginationMetaOf<PaginationConfigOf<T>>,
                PaginationLinksOf<PaginationConfigOf<T>>,
                ExtraMeta
            >;
        }

        return response as unknown as PaginatedResponse<
            InstanceType<T>,
            PaginationMetaOf<PaginationConfigOf<T>>,
            PaginationLinksOf<PaginationConfigOf<T>>,
            ExtraMeta
        >;
    }

    /** Creates a project-wide typed Resource base class. */
    static configure<
        const Override extends PaginationConfig,
        BaseConfig extends AnyResolvedPaginationConfig,
    >(
        this: ConfiguredResourceConstructor<BaseConfig>,
        configuration: { pagination: Override },
    ): ConfiguredResourceConstructor<MergePaginationConfig<BaseConfig, Override>>;
    static configure<const Override extends PaginationConfig>(
        this: typeof Resource,
        configuration: { pagination: Override },
    ): ConfiguredResourceConstructor<
        MergePaginationConfig<ResolvedPaginationConfig, Override>
    >;
    static configure(
        this: typeof Resource,
        configuration: { pagination: PaginationConfig },
    ): ConfiguredResourceConstructor<AnyResolvedPaginationConfig> {
        return this.configurePagination(
            configuration.pagination,
        ) as unknown as ConfiguredResourceConstructor<AnyResolvedPaginationConfig>;
    }

    /** Creates a typed Resource base class with local pagination overrides. */
    static configurePagination<
        const Override extends PaginationConfig,
        BaseConfig extends AnyResolvedPaginationConfig,
    >(
        this: ConfiguredResourceConstructor<BaseConfig>,
        configuration: Override,
    ): ConfiguredResourceConstructor<MergePaginationConfig<BaseConfig, Override>>;
    static configurePagination<const Override extends PaginationConfig>(
        this: typeof Resource,
        configuration: Override,
    ): ConfiguredResourceConstructor<
        MergePaginationConfig<ResolvedPaginationConfig, Override>
    >;
    static configurePagination(
        this: typeof Resource,
        configuration: PaginationConfig,
    ): ConfiguredResourceConstructor<AnyResolvedPaginationConfig> {
        const baseResource = this;
        const inheritedConfig = baseResource.paginationConfig as ResolvedPaginationConfig;
        const links = configuration.links ?? inheritedConfig.links;
        const paginationConfig = {
            meta: configuration.meta ?? inheritedConfig.meta,
            ...(links ? { links } : {}),
        };

        return class extends baseResource {
            static readonly paginationConfig = paginationConfig;
        } as unknown as ConfiguredResourceConstructor<AnyResolvedPaginationConfig>;
    }
}

type ResourceConstructor = new (data: never) => Resource;

/** Pagination values supplied by an adapter or application. */
export type PaginationInput = {
  /** One-based current page number. */
  page: number;
  /** Maximum number of resources on one page. */
  limit: number;
  /** Total number of resources across all pages. */
  total: number;
};

/** Derived pagination values passed to metadata and link factories. */
export type PaginationState = PaginationInput & {
  /** Total page count, calculated as `Math.ceil(total / limit)`. */
  pages: number;
  /** Whether a page exists before the current page. */
  hasPreviousPage: boolean;
  /** Whether a page exists after the current page. */
  hasNextPage: boolean;
};

/** Metadata returned by {@link Resource.paginate} without custom configuration. */
export type DefaultPaginationMeta = {
  /** One-based current page number. */
  page: number;
  /** Maximum number of resources on one page. */
  limit: number;
  /** Total number of resources across all pages. */
  total: number;
  /** Total page count, calculated as `Math.ceil(total / limit)`. */
  pages: number;
};

/**
 * Creates the metadata object for a paginated response.
 *
 * @typeParam Meta - Metadata shape returned by the factory.
 */
export type PaginationMetaFactory<Meta extends object> = (
  state: PaginationState,
) => Meta;

/**
 * Framework-agnostic request data available to a pagination link factory.
 *
 * Applications may attach additional fields for their own adapters.
 */
export type PaginationLinkContext = {
  /** Base path used to build pagination URLs. */
  path?: string;
  /** Request query parameters. */
  query?: Readonly<Record<string, unknown>>;
  /** Active resource filters. */
  filter?: Readonly<Record<string, unknown>>;
  /** Active resource sorting options. */
  sort?: Readonly<Record<string, unknown>>;
  /** Active search term. */
  search?: string;
  /** Adapter-specific context fields. */
  [key: string]: unknown;
};

/**
 * Creates the links object for a paginated response.
 *
 * @typeParam Links - Links shape returned by the factory.
 */
export type PaginationLinksFactory<Links extends object> = (
  state: PaginationState,
  context: PaginationLinkContext,
) => Links;

/**
 * Controls the metadata and links emitted by paginated responses.
 *
 * @typeParam Meta - Configured pagination metadata shape.
 * @typeParam Links - Configured pagination links shape.
 */
export type PaginationConfig<
  Meta extends object = object,
  Links extends object = object,
> = {
  /** Replaces the default pagination metadata factory. */
  meta?: PaginationMetaFactory<Meta>;
  /** Creates pagination links, or disables inherited links when set to `false`. */
  links?: PaginationLinksFactory<Links> | false;
};

type ResolvedPaginationConfig<
  Meta extends object = DefaultPaginationMeta,
  Links extends object = never,
> = {
  meta: PaginationMetaFactory<Meta>;
  links?: PaginationLinksFactory<Links>;
};

type AnyResolvedPaginationConfig = ResolvedPaginationConfig<object, object>;

type PaginationMetaOf<Config> = Config extends {
  meta: (state: PaginationState) => infer Meta extends object;
}
  ? Meta
  : DefaultPaginationMeta;

type PaginationLinksOf<Config> = Config extends { links?: false }
  ? never
  : Config extends {
        links?: (
          state: PaginationState,
          context: PaginationLinkContext,
        ) => infer Links extends object;
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
  Override extends { links: false }
    ? never
    : Override extends {
          links: (
            state: PaginationState,
            context: PaginationLinkContext,
          ) => infer Links extends object;
        }
      ? Links
      : PaginationLinksOf<Base>
>;

type PaginationConfigOf<T> = T extends {
  readonly paginationConfig: infer Config;
}
  ? Config extends AnyResolvedPaginationConfig
    ? Config
    : ResolvedPaginationConfig
  : ResolvedPaginationConfig;

type ConfiguredResourceConstructor<Config extends AnyResolvedPaginationConfig> =
  typeof Resource & {
    readonly paginationConfig: Config;
  };

type WithoutPaginationKeyConflicts<
  BaseMeta extends object,
  ExtraMeta extends object,
> = {
  [Key in keyof ExtraMeta]: Key extends keyof BaseMeta ? never : ExtraMeta[Key];
};
type MergeMeta<BaseMeta extends object, ExtraMeta extends object> = [
  keyof ExtraMeta,
] extends [never]
  ? BaseMeta
  : BaseMeta & ExtraMeta;

/**
 * Response returned by {@link Resource.paginate}.
 *
 * The `links` property is present only when a link factory is configured.
 *
 * @typeParam ResourceType - Concrete resource stored in `data`.
 * @typeParam BaseMeta - Metadata produced by the configured factory.
 * @typeParam Links - Links produced by the configured factory.
 * @typeParam ExtraMeta - Endpoint-specific metadata merged into `meta`.
 */
export type PaginatedResponse<
  ResourceType extends Resource,
  BaseMeta extends object,
  Links extends object = never,
  ExtraMeta extends object = Record<never, never>,
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
  meta: (state) => ({
    page: state.page,
    limit: state.limit,
    total: state.total,
    pages: state.pages,
  }),
};

/**
 * Base class for constructor-driven API resources.
 *
 * A concrete resource constructor defines both the accepted domain value and
 * the public response shape. Static helpers preserve the concrete class type.
 */
export abstract class Resource {
  /** Resolved pagination configuration inherited by derived resource classes. */
  static readonly paginationConfig: unknown = defaultPaginationConfig;

  /**
   * Creates a concrete resource from one domain value.
   *
   * @param data - Value accepted by the concrete resource constructor.
   * @returns A new instance of the concrete resource class.
   */
  static make<T extends ResourceConstructor>(
    this: T,
    data: ConstructorParameters<T>[0],
  ): InstanceType<T> {
    return new this(data) as InstanceType<T>;
  }

  /**
   * Creates a separate concrete resource for every domain value.
   *
   * @param data - Values accepted by the concrete resource constructor.
   * @returns Resource instances in the same order as the input values.
   */
  static collection<T extends ResourceConstructor>(
    this: T,
    data: ConstructorParameters<T>[0][],
  ): InstanceType<T>[] {
    return data.map((item) => new this(item) as InstanceType<T>);
  }

  /**
   * Creates a paginated response from a concrete resource collection.
   *
   * @param data - Values accepted by the concrete resource constructor.
   * @param pagination - Current page, page size, and total resource count.
   * @param extraMeta - Endpoint-specific metadata merged into `meta`.
   * @param context - Framework-agnostic data passed to the link factory.
   * @returns Typed resource data, metadata, and configured links.
   */
  static paginate<
    T extends ResourceConstructor,
    ExtraMeta extends object = Record<never, never>,
  >(
    this: T,
    data: ConstructorParameters<T>[0][],
    pagination: PaginationInput,
    extraMeta?: ExtraMeta &
      WithoutPaginationKeyConflicts<
        PaginationMetaOf<PaginationConfigOf<T>>,
        NoInfer<ExtraMeta>
      >,
    context?: PaginationLinkContext,
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
    const configuredResource = this as T &
      typeof Resource & {
        readonly paginationConfig: PaginationConfigOf<T>;
      };
    const response = {
      data: configuredResource.collection(data),
      meta: {
        ...configuredResource.paginationConfig.meta(state),
        ...(extraMeta ?? {}),
      },
    };

    if (configuredResource.paginationConfig.links) {
      return {
        ...response,
        links: configuredResource.paginationConfig.links(state, context ?? {}),
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

  /**
   * Creates a typed Resource base class with project-wide pagination defaults.
   *
   * @param configuration - Pagination metadata and link configuration.
   * @returns A Resource subclass that can be extended by concrete resources.
   */
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
    return this.configurePagination(configuration.pagination);
  }

  /**
   * Creates a typed Resource base class with local pagination overrides.
   *
   * Unspecified settings are inherited. Set `links` to `false` to remove an
   * inherited link factory from both runtime output and the response type.
   *
   * @param configuration - Pagination settings to override.
   * @returns A Resource subclass with the merged pagination configuration.
   */
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
    const inheritedConfig = this.paginationConfig as ResolvedPaginationConfig;
    const links =
      configuration.links === false
        ? undefined
        : (configuration.links ?? inheritedConfig.links);
    const paginationConfig = {
      meta: configuration.meta ?? inheritedConfig.meta,
      ...(links ? { links } : {}),
    };

    return class extends this {
      static readonly paginationConfig = paginationConfig;
    };
  }
}

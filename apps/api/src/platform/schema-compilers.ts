// zod in Fastify, without fastify-type-provider-zod (docs/mvp/21 §4, J1-A).
// - Validation: safeParse; a failure becomes a RequestValidationError (400, field and rule only).
// - Serialization: parse, then JSON.stringify. A z.object strips every undeclared field: this is
//   the second line of defence of the anonymisation (02 §2.5, point 4).
// - Fallback: the error envelope is the `default` response schema of every route, so that no
//   status code escapes the output filter (18 TM11.4, 21 J1-J B1).
// - Type provider: route handlers get the zod output type of their schemas.
import { errorEnvelopeSchema } from "@influx/contracts/errors";
import type {
  FastifySchema,
  FastifySchemaCompiler,
  FastifySerializerCompiler,
  FastifyTypeProvider,
} from "fastify";
import * as z from "zod";
import { RequestValidationError } from "./errors.ts";

export interface ZodTypeProvider extends FastifyTypeProvider {
  readonly validator: this["schema"] extends z.ZodType
    ? z.output<this["schema"]>
    : unknown;
  readonly serializer: this["schema"] extends z.ZodType
    ? z.input<this["schema"]>
    : unknown;
}

function asZodSchema(schema: unknown, where: string): z.ZodType {
  if (!(schema instanceof z.ZodType)) {
    throw new TypeError(`${where}: route schemas must be zod schemas`);
  }
  return schema;
}

export const zodValidatorCompiler: FastifySchemaCompiler<unknown> = ({
  schema,
  method,
  url,
  httpPart,
}) => {
  const zodSchema = asZodSchema(schema, `${method} ${url} ${httpPart ?? ""}`);
  return (data: unknown) => {
    const result = zodSchema.safeParse(data);
    if (result.success) {
      return { value: result.data };
    }
    return {
      error: new RequestValidationError(
        result.error.issues.map((issue) => ({
          path: issue.path.map(String).join("."),
          issue: issue.code,
        })),
      ),
    };
  };
};

export const zodSerializerCompiler: FastifySerializerCompiler<unknown> = ({
  schema,
  method,
  url,
  httpStatus,
}) => {
  const zodSchema = asZodSchema(
    schema,
    `${method} ${url} response ${httpStatus ?? ""}`,
  );
  // A payload that does not match its schema throws: Fastify turns it into a 500 (T13).
  return (data: unknown) => JSON.stringify(zodSchema.parse(data));
};

/** A success status code, alone or as a class: 200, 201, "2xx". */
const SUCCESS_STATUS_KEY = /^2(?:\d\d|xx)$/;

/**
 * zod types a 2xx response schema may use: an allow-list (21 J1-J N2, F-1). Every one either
 * declares its exact shape, or wraps a schema that is walked in turn. Refused, among others:
 * `any` and `unknown` (let anything through), `record` (keys chosen by the data), `transform`
 * (output computed by code, after validation), `custom` (`z.custom`, `z.instanceof`), `map`,
 * `set`. An object is refused when it has a catchall (`looseObject`, `passthrough`, `catchall`):
 * only the catchall of `strictObject`, `never`, is accepted, since it lets nothing through.
 */
const LEAF_TYPES: ReadonlySet<string> = new Set([
  "string",
  "number",
  "boolean",
  "null",
  "undefined",
  "never",
  "literal",
  "enum",
  "date",
  "template_literal",
]);
const WRAPPER_TYPES: ReadonlySet<string> = new Set([
  "optional",
  "nullable",
  "default",
  "prefault",
  "nonoptional",
  "readonly",
  "catch",
]);

/** The definition of a zod schema: its `type`, and the children the walk needs. */
type ZodDefinition = {
  type: string;
  shape?: Record<string, z.ZodType>;
  catchall?: z.ZodType;
  element?: z.ZodType;
  innerType?: z.ZodType;
  options?: readonly z.ZodType[];
  left?: z.ZodType;
  right?: z.ZodType;
  items?: readonly z.ZodType[];
  rest?: z.ZodType | null;
  in?: z.ZodType;
  out?: z.ZodType;
  getter?: () => z.ZodType;
};

function definitionOf(schema: z.ZodType): ZodDefinition {
  return schema._zod.def as ZodDefinition;
}

/**
 * Walks a response schema and returns the first refused place, as `path: reason`, or null. The
 * path starts at the status code (`200.items[].meta`). Lazy schemas are walked once.
 */
export function findPermissiveSchema(
  schema: z.ZodType,
  path: string,
  seen: Set<z.ZodType> = new Set(),
): string | null {
  if (seen.has(schema)) {
    return null;
  }
  seen.add(schema);
  const definition = definitionOf(schema);
  const { type } = definition;
  const walk = (child: z.ZodType | undefined, childPath: string) =>
    child === undefined ? null : findPermissiveSchema(child, childPath, seen);
  const walkAll = (children: readonly z.ZodType[], childPath: string) => {
    for (const child of children) {
      const found = walk(child, childPath);
      if (found !== null) {
        return found;
      }
    }
    return null;
  };
  if (LEAF_TYPES.has(type)) {
    return null;
  }
  if (WRAPPER_TYPES.has(type)) {
    return walk(definition.innerType, path);
  }
  switch (type) {
    case "object": {
      const catchall = definition.catchall;
      if (catchall !== undefined && definitionOf(catchall).type !== "never") {
        return `${path}: an object with a catchall (looseObject, passthrough, catchall) lets undeclared fields through`;
      }
      for (const [key, child] of Object.entries(definition.shape ?? {})) {
        const found = walk(child, `${path}.${key}`);
        if (found !== null) {
          return found;
        }
      }
      return null;
    }
    case "array":
      return walk(definition.element, `${path}[]`);
    case "union":
      return walkAll(definition.options ?? [], path);
    case "intersection":
      return walkAll(
        [definition.left, definition.right].filter(
          (child) => child !== undefined,
        ),
        path,
      );
    case "tuple":
      return walkAll(
        [
          ...(definition.items ?? []),
          ...(definition.rest ? [definition.rest] : []),
        ],
        `${path}[]`,
      );
    case "pipe":
      return walkAll(
        [definition.in, definition.out].filter((child) => child !== undefined),
        path,
      );
    case "lazy":
      return walk(definition.getter?.(), path);
    case "any":
    case "unknown":
      return `${path}: ${type} lets any value through`;
    case "record":
      return `${path}: a record lets keys chosen by the data through`;
    case "transform":
      return `${path}: a transform computes the output by code, after validation`;
    default:
      return `${path}: the zod type "${type}" is not allowed in a response schema`;
  }
}

/**
 * Response schemas of a route, checked and completed when the route is registered (02 §4 rule 1,
 * 18 TM11.4 b and c, 21 J1-J B1). Throws when a rule is broken: the server then refuses to start.
 * - The route declares at least one 2xx schema, and 2xx schemas only: an error answer is always
 *   the error envelope, never a shape of the route's own.
 * - Each 2xx schema is walked: `any`, `unknown`, `record`, a catchall, a transform or any zod type
 *   outside the allow-list refuses the route (21 J1-J N2, F-1).
 * - The envelope is added as the `default` schema, which Fastify uses for every status code the
 *   route does not declare. This is the fallback serializer: a payload sent with an undeclared
 *   code is written only if it IS an envelope; anything else throws, and the error handler
 *   answers a 500 envelope instead, without any field of the original payload.
 */
export function withEnvelopeFallback(
  routeName: string,
  schema: FastifySchema | undefined,
): FastifySchema {
  const response = schema?.response;
  if (typeof response !== "object" || response === null) {
    throw new Error(`Route ${routeName} has no response schema`);
  }
  const statuses = Object.keys(response);
  if (!statuses.some((status) => SUCCESS_STATUS_KEY.test(status))) {
    throw new Error(`Route ${routeName} declares no 2xx response schema`);
  }
  const others = statuses.filter((status) => !SUCCESS_STATUS_KEY.test(status));
  if (others.length > 0) {
    throw new Error(
      `Route ${routeName} declares non-2xx response schemas (${others.join(", ")}): ` +
        "an error answer is always the error envelope",
    );
  }
  // A schema that lets undeclared data through is not an output filter (21 J1-J N2, F-1).
  for (const [status, statusSchema] of Object.entries(response)) {
    const permissive = findPermissiveSchema(
      asZodSchema(statusSchema, `${routeName} response ${status}`),
      status,
    );
    if (permissive !== null) {
      throw new Error(
        `Route ${routeName} has a permissive response schema at ${permissive}`,
      );
    }
  }
  return {
    ...schema,
    response: { ...response, default: errorEnvelopeSchema },
  };
}

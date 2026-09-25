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
 * Response schemas of a route, checked and completed when the route is registered (02 §4 rule 1,
 * 18 TM11.4 b and c, 21 J1-J B1). Throws when a rule is broken: the server then refuses to start.
 * - The route declares at least one 2xx schema, and 2xx schemas only: an error answer is always
 *   the error envelope, never a shape of the route's own.
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
  return {
    ...schema,
    response: { ...response, default: errorEnvelopeSchema },
  };
}

// zod in Fastify, without fastify-type-provider-zod (docs/mvp/21 §4, J1-A).
// - Validation: safeParse; a failure becomes a RequestValidationError (400, field and rule only).
// - Serialization: parse, then JSON.stringify. A z.object strips every undeclared field: this is
//   the second line of defence of the anonymisation (02 §2.5, point 4).
// - Type provider: route handlers get the zod output type of their schemas.
import type {
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

import { stdErrorResponses } from './components';

type OpOptions = {
  secured?: boolean;
  deprecated?: boolean;
  description?: string;
  parameters?: Record<string, unknown>[];
  requestBody?: Record<string, unknown>;
  responses?: Record<string, unknown>;
};

export function op(tag: string, summary: string, opts: OpOptions = {}) {
  const operation: Record<string, unknown> = {
    tags: [tag],
    summary,
    responses: {
      ...stdErrorResponses,
      ...(opts.responses ?? { '200': { description: 'OK' } }),
    },
  };

  if (opts.description) {
    operation.description = opts.description;
  }

  if (opts.secured !== false) {
    operation.security = [{ bearerAuth: [] }];
  }

  if (opts.deprecated) {
    operation.deprecated = true;
  }

  if (opts.parameters?.length) {
    operation.parameters = opts.parameters;
  }

  if (opts.requestBody) {
    operation.requestBody = opts.requestBody;
  }

  return operation;
}

export function jsonBody(schemaRef: string, required = true) {
  return {
    required,
    content: {
      'application/json': {
        schema: { $ref: schemaRef },
      },
    },
  };
}

export function jsonResponse(schemaRef: string, description: string) {
  return {
    description,
    content: {
      'application/json': {
        schema: { $ref: schemaRef },
      },
    },
  };
}

export function jsonBodyObject(description?: string) {
  return {
    required: true,
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/JsonObject' },
        ...(description ? { description } : {}),
      },
    },
  };
}

export function multipartBody(description: string) {
  return {
    required: true,
    content: {
      'multipart/form-data': {
        schema: {
          type: 'object',
          properties: {
            file: { type: 'string', format: 'binary' },
          },
          required: ['file'],
        },
        description,
      },
    },
  };
}

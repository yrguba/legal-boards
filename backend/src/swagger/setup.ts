import { Express, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiSpec } from './spec';

function isSwaggerEnabled(): boolean {
  const raw = process.env.SWAGGER_ENABLED;
  if (raw === undefined || raw === '') return true;
  return !['0', 'false', 'no', 'off'].includes(raw.toLowerCase());
}

export function setupSwagger(app: Express): void {
  if (!isSwaggerEnabled()) {
    return;
  }

  const spec = buildOpenApiSpec();

  app.get('/api/docs/openapi.json', (_req: Request, res: Response) => {
    res.json(spec);
  });

  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: 'Legal Boards API',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
      },
    }),
  );
}

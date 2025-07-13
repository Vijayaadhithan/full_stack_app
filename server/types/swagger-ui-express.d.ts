declare module 'swagger-ui-express' {
  import { RequestHandler } from 'express';
  const swaggerUi: {
    serve: RequestHandler[];
    setup(swaggerDoc?: any, options?: any): RequestHandler;
  };
  export = swaggerUi;
}
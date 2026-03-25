import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';

type ValidationSchemas = {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
};

export function validateRequest(schemas: ValidationSchemas) {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (schemas.params) {
      const parsedParams = schemas.params.parse(request.params);
      Object.keys(request.params).forEach((key) => {
        delete request.params[key];
      });
      Object.assign(request.params, parsedParams);
    }

    if (schemas.query) {
      const parsedQuery = schemas.query.parse(request.query);
      const queryTarget = request.query as Record<string, unknown>;
      Object.keys(queryTarget).forEach((key) => {
        delete queryTarget[key];
      });
      Object.assign(queryTarget, parsedQuery);
    }

    if (schemas.body) {
      request.body = schemas.body.parse(request.body);
    }

    next();
  };
}

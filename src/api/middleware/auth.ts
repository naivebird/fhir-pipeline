import { Request, Response, NextFunction } from 'express';

const API_KEY = process.env.API_KEY || 'DEMO_API_KEY_CHANGE_IN_PRODUCTION';
const API_KEY_HEADER = 'x-api-key';
const API_KEY_QUERY = 'api_key';

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  // Accept API key from header or query parameter (for browser demo)
  const providedKey = (req.headers[API_KEY_HEADER] as string | undefined)
    || (req.query[API_KEY_QUERY] as string | undefined);

  if (!providedKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: `Missing API key. Provide via '${API_KEY_HEADER}' header or '${API_KEY_QUERY}' query parameter.`,
    });
    return;
  }

  if (providedKey !== API_KEY) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API key',
    });
    return;
  }

  next();
}

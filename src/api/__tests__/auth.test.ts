import { Request, Response, NextFunction } from 'express';
import { apiKeyAuth } from '../middleware/auth';

// The API_KEY is set at module load time, so we use the default value for tests
const DEFAULT_API_KEY = 'DEMO_API_KEY_CHANGE_IN_PRODUCTION';

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockRequest = {
      headers: {},
      query: {},
    };

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    nextFunction = jest.fn();
  });

  describe('apiKeyAuth', () => {
    it('should call next() when valid API key is provided in header', () => {
      mockRequest.headers = { 'x-api-key': DEFAULT_API_KEY };

      apiKeyAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should call next() when valid API key is provided in query parameter', () => {
      mockRequest.query = { api_key: DEFAULT_API_KEY };

      apiKeyAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return 401 when no API key is provided', () => {
      apiKeyAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: expect.stringContaining('Missing API key'),
      });
    });

    it('should return 403 when invalid API key is provided in header', () => {
      mockRequest.headers = { 'x-api-key': 'wrong-key' };

      apiKeyAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Invalid API key',
      });
    });

    it('should return 403 when invalid API key is provided in query', () => {
      mockRequest.query = { api_key: 'wrong-key' };

      apiKeyAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Invalid API key',
      });
    });

    it('should prefer header over query parameter', () => {
      mockRequest.headers = { 'x-api-key': DEFAULT_API_KEY };
      mockRequest.query = { api_key: 'wrong-key' };

      apiKeyAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should fall back to query parameter when header is empty', () => {
      mockRequest.headers = {};
      mockRequest.query = { api_key: DEFAULT_API_KEY };

      apiKeyAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should accept the default API key value', () => {
      mockRequest.headers = { 'x-api-key': 'DEMO_API_KEY_CHANGE_IN_PRODUCTION' };

      apiKeyAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should include helpful message about how to provide API key', () => {
      apiKeyAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: expect.stringMatching(/x-api-key.*header.*api_key.*query/i),
      });
    });
  });
});

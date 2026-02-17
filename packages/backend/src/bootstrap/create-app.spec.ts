import { createApp } from './create-app';
import { INestApplication } from '@nestjs/common';

describe('createApp', () => {
  it('should call useGlobalPipes and enableCors', () => {
    const mockApp: Partial<INestApplication> = {
      useGlobalPipes: jest.fn().mockReturnThis(),
      enableCors: jest.fn().mockReturnThis()
    };

    const result = createApp(mockApp as INestApplication);

    expect(mockApp.useGlobalPipes).toHaveBeenCalledTimes(1);
    expect(mockApp.enableCors).toHaveBeenCalledTimes(1);
    expect(mockApp.enableCors).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: true
      })
    );
    expect(result).toBe(mockApp);
  });
});

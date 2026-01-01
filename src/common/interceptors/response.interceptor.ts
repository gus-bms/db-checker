import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, map } from 'rxjs';

type Envelope<T> = {
  requestId: string | null;
  success: true;
  code: 'OK';
  message: null;
  data: T;
  error: null;
};

@Injectable()
export class ResponseEnvelopeInterceptor<
  T = unknown,
> implements NestInterceptor<T, Envelope<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<Envelope<T>> {
    const req = context.switchToHttp().getRequest<Request>();

    const requestId = typeof req.requestId === 'string' ? req.requestId : null;

    return next.handle().pipe(
      map((data: T) => ({
        requestId,
        success: true,
        code: 'OK',
        message: null,
        data,
        error: null,
      })),
    );
  }
}

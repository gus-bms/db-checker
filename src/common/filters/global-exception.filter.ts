import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
// Prisma를 쓰고 있다면(선택):
// import { Prisma } from '@prisma/client';

type ErrorEnvelope = {
  requestId: string | null;
  success: false;
  code: string;
  message: string;
  data: null;
  error: {
    type: string;
    details: unknown[];
  };
};

type DomainLikeResponse = {
  code?: unknown;
  message?: unknown;
  type?: unknown;
  details?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asStringOrUndefined(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function asUnknownArrayOrUndefined(v: unknown): unknown[] | undefined {
  return Array.isArray(v) ? v : undefined;
}

function safeToMessage(value: unknown): string {
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  if (value instanceof Error) return value.message;

  if (value == null) return 'Unknown error';

  // object/array 등은 JSON으로
  try {
    return JSON.stringify(value);
  } catch {
    return 'Unstringifiable error object';
  }
}

/**
 * Prisma Known Request Error 감지(선택)
 * - Prisma를 import할 수 있으면 instanceof로 가장 정확하게 처리 권장
 * - import를 피하고 싶으면 name/code 기반으로 "가드"만 해도 lint는 안전합니다.
 */
function isPrismaKnownRequestError(
  exception: unknown,
): exception is { name: string; code?: string; meta?: unknown } {
  if (!isRecord(exception)) return false;
  return exception['name'] === 'PrismaClientKnownRequestError';
}

// Prisma를 import할 수 있다면 위 대신 아래처럼 더 정확히:
// function isPrismaKnownRequestError(
//   exception: unknown,
// ): exception is Prisma.PrismaClientKnownRequestError {
//   return exception instanceof Prisma.PrismaClientKnownRequestError;
// }

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const requestId = typeof req.requestId === 'string' ? req.requestId : null;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;

    // 기본 payload
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let type = 'INTERNAL_ERROR';
    let details: unknown[] = [];

    if (exception instanceof UnauthorizedException) {
      status = HttpStatus.UNAUTHORIZED;
      code = 'AUTH_ERROR';
      type = 'AUTH_ERROR';
      // message는 기본값 유지 or 필요 시 커스텀
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();

      const response = exception.getResponse(); // unknown | object | string 등

      // DomainException 등에서 object를 내려주는 형태 우선 수용
      if (isRecord(response)) {
        const r = response as DomainLikeResponse;

        code = asStringOrUndefined(r.code) ?? code;
        message = asStringOrUndefined(r.message) ?? message;
        type = asStringOrUndefined(r.type) ?? type;
        details = asUnknownArrayOrUndefined(r.details) ?? details;
      } else {
        message = safeToMessage(response);
      }
    } else if (isPrismaKnownRequestError(exception)) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'DB_ERROR';
      message = 'Database error';
      type = 'INTERNAL_ERROR';

      const prismaCode =
        isRecord(exception) && typeof exception.code === 'string'
          ? exception.code
          : undefined;

      details = prismaCode ? [{ prismaCode }] : [];
    } else if (exception instanceof Error) {
      // 일반 Error 처리 (여기서 message/type을 채워줘야 함)
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'INTERNAL_ERROR';
      message = exception.message || message;
      type = exception.name || type;

      // 운영에서는 stack을 숨기고, 개발에서는 노출(또는 로그만)
      if (process.env.NODE_ENV !== 'production') {
        details = [{ stack: exception.stack }];
      }

      // logger.error(exception.message, exception.stack);
    } else {
      // Error도 아니고 HttpException도 아닌 unknown
      message = typeof exception === 'string' ? exception : message;
    }

    // 운영서비스 권장: 캐시 금지
    res.setHeader('Cache-Control', 'no-store');

    const body: ErrorEnvelope = {
      requestId,
      success: false,
      code,
      message,
      data: null,
      error: {
        type,
        details,
      },
    };

    res.status(status).json(body);
  }
}

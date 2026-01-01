import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 전역 응답 래핑
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());

  // 전역 예외 처리
  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();

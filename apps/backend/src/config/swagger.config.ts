/*
역할: REST API의 Swagger 문서 설정과 문서 경로를 등록한다.
전체 흐름: main.ts → setupSwagger() → SwaggerModule → /api-docs
*/
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  // API 제목·버전과 JWT Bearer 인증 방식을 문서 설정에 등록한다.
  const config = new DocumentBuilder()
    .setTitle('마음잇다 API')
    .setDescription('마음잇다 백엔드 REST API 명세서')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  // Controller와 DTO의 Swagger 데코레이터를 읽어 OpenAPI 문서를 생성한다.
  const document = SwaggerModule.createDocument(app, config);

  // 생성한 문서를 /api-docs 경로의 Swagger UI로 제공한다.
  SwaggerModule.setup('api-docs', app, document, {
    jsonDocumentUrl: '/api-docs-json',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}

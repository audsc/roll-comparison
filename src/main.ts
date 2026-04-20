import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import session from 'express-session';
import passport from 'passport';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.ANGULAR_APP_URL ?? 'http://localhost:4200',
    credentials: true,
  });

  app.use(
    session({
      secret: process.env.SESSION_SECRET ?? 'change-me-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 3600000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      },
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Roll Comparison API')
    .setDescription('WHOOP workout comparison — share a session link, everyone auths, get side-by-side metrics')
    .setVersion('1.0')
    .addTag('sessions', 'Create and manage comparison sessions')
    .addTag('comparisons', 'Fetch stored comparison results')
    .addTag('auth', 'WHOOP OAuth flow')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
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

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

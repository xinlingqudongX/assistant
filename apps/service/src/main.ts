import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // 启用 CORS
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true
  })

  // 设置全局前缀
  app.setGlobalPrefix('api')

  const port = process.env.PORT || 3110

  await app.listen(port)

  console.log(`AI Council Service running on http://localhost:${port}`)
  console.log(`WebSocket available at ws://localhost:${port}/ws`)
}

bootstrap()

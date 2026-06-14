import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('database.url'),
        poolSize: config.get<number>('database.poolSize'),
        synchronize: false,                     // always use migrations in production
        migrationsRun: false,
        logging: config.get<string>('env') === 'development' ? ['query', 'error'] : ['error'],
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/../../database/migrations/*{.ts,.js}'],
        ssl: config.get<boolean>('isProd') ? { rejectUnauthorized: true } : false,
        extra: {
          max: config.get<number>('database.poolSize'),
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
          statement_timeout: 30000,
        },
      }),
    }),
  ],
})
export class DatabaseModule {}

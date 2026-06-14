import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  async findById(id: string): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email: email.toLowerCase() } });
  }

  async updateProfile(userId: string, updates: Partial<Pick<User, 'firstName' | 'lastName' | 'displayName' | 'phone' | 'timezone' | 'locale'>>): Promise<User> {
    await this.repo.update(userId, { ...updates, updatedAt: new Date() });
    return this.findById(userId);
  }

  async updateAvatar(userId: string, avatarUrl: string): Promise<void> {
    await this.repo.update(userId, { avatarUrl, updatedAt: new Date() });
  }

  async deactivate(userId: string, reason: string): Promise<void> {
    await this.repo.update(userId, {
      status: 'deactivated',
      deactivatedAt: new Date(),
      deactivatedReason: reason,
      updatedAt: new Date(),
    } as any);
  }
}

import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly dataSource: DataSource) {}

  async getFeatures(tier: string): Promise<any[]> {
    return this.dataSource.query(
      `SELECT feature_key, feature_label, enabled, limit_value, limit_unit
       FROM subscription_features WHERE tier = $1`,
      [tier],
    );
  }

  async hasFeature(tier: string, featureKey: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT enabled FROM subscription_features WHERE tier = $1 AND feature_key = $2`,
      [tier, featureKey],
    );
    return rows[0]?.enabled === true;
  }

  async getLimit(tier: string, featureKey: string): Promise<number | null> {
    const rows = await this.dataSource.query(
      `SELECT limit_value FROM subscription_features WHERE tier = $1 AND feature_key = $2`,
      [tier, featureKey],
    );
    return rows[0]?.limit_value ?? null;
  }

  async getOrgTier(orgId: string): Promise<string> {
    const rows = await this.dataSource.query(
      `SELECT subscription_tier FROM organizations WHERE id = $1`,
      [orgId],
    );
    return rows[0]?.subscription_tier ?? 'free';
  }
}

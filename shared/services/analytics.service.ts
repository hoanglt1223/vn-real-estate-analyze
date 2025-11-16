import { kv } from '@vercel/kv';

export class PropertyAnalyticsService {
  // Track property view
  static async trackView(propertyId: string, metadata?: any): Promise<void> {
    const key = `views:${propertyId}:${new Date().toISOString().split('T')[0]}`;
    await kv.incr(key);
    await kv.expire(key, 86400 * 30); // Keep for 30 days
  }

  // Track property contact click
  static async trackContact(propertyId: string, userId?: string): Promise<void> {
    const key = `contacts:${propertyId}:${new Date().toISOString().split('T')[0]}`;
    await kv.incr(key);
    await kv.expire(key, 86400 * 30); // Keep for 30 days
  }

  // Get property analytics
  static async getPropertyAnalytics(propertyId: string): Promise<{
    totalViews: number;
    totalContacts: number;
    dailyViews: number;
    dailyContacts: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const viewsKey = `views:${propertyId}:${today}`;
    const contactsKey = `contacts:${propertyId}:${today}`;

    const [dailyViews, dailyContacts] = await Promise.all([
      kv.get(viewsKey),
      kv.get(contactsKey)
    ]);

    return {
      totalViews: Number(dailyViews || 0),
      totalContacts: Number(dailyContacts || 0),
      dailyViews: Number(dailyViews || 0),
      dailyContacts: Number(dailyContacts || 0)
    };
  }
}
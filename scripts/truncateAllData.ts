import 'dotenv/config';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });

const tables = [
    'booking_history',
    'bookings',
    'service_availability',
    'blocked_time_slots',
    'services',
    'reviews',
    'waitlist',
    'order_status_updates',
    'returns',
    'order_items',
    'product_reviews',
    'orders',
    'cart',
    'wishlist',
    'products',
    'promotions',
    'notifications',
    'shop_workers',
    'providers',
    'shops',
    'password_reset_tokens',
    'magic_link_tokens',
    'email_verification_tokens',
    'sessions',
    'email_notification_preferences',
    'admin_audit_logs',
    'admin_role_permissions',
    'admin_users',
    'admin_permissions',
    'admin_roles',
    'users',
];

async function truncateAll() {
    console.log('⚠️  Truncating all tables (keeping structure)...\n');

    for (const table of tables) {
        try {
            await sql.unsafe(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
            console.log(`✅ Truncated: ${table}`);
        } catch (error: any) {
            // Table might not exist yet (e.g., if migrations haven't run)
            console.log(`⚠️  Skipped: ${table} - ${error.message}`);
        }
    }

    console.log('\n✅ All data has been removed successfully! Tables are preserved.');
    await sql.end();
}

truncateAll().catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
});

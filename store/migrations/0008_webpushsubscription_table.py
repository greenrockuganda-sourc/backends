from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('store', '0007_notification_channels_notification_read_at_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE TABLE IF NOT EXISTS web_push_subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                endpoint TEXT NOT NULL UNIQUE,
                p256dh VARCHAR(255),
                auth VARCHAR(255),
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                user_id BIGINT NULL REFERENCES auth_user(id) ON DELETE SET NULL
            );
            """,
            reverse_sql="DROP TABLE IF EXISTS web_push_subscriptions;",
        ),
    ]

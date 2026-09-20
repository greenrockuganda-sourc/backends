from django.db import connection, migrations


def create_web_push_table_if_missing(apps, schema_editor):
    vendor = connection.vendor
    if vendor == 'postgresql':
        schema_editor.execute("""
            CREATE TABLE IF NOT EXISTS web_push_subscriptions (
                id BIGSERIAL PRIMARY KEY,
                endpoint TEXT NOT NULL UNIQUE,
                p256dh VARCHAR(255),
                auth VARCHAR(255),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL
            );
        """)
    elif vendor == 'sqlite':
        schema_editor.execute("""
            CREATE TABLE IF NOT EXISTS web_push_subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                endpoint TEXT NOT NULL UNIQUE,
                p256dh VARCHAR(255),
                auth VARCHAR(255),
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL
            );
        """)
    else:
        schema_editor.execute("""
            CREATE TABLE IF NOT EXISTS web_push_subscriptions (
                id SERIAL PRIMARY KEY,
                endpoint TEXT NOT NULL UNIQUE,
                p256dh VARCHAR(255),
                auth VARCHAR(255),
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                user_id BIGINT NULL
            );
        """)


def drop_web_push_table_if_exists(apps, schema_editor):
    schema_editor.execute("DROP TABLE IF EXISTS web_push_subscriptions;")


class Migration(migrations.Migration):

    dependencies = [
        ('store', '0007_notification_channels_notification_read_at_and_more'),
    ]

    operations = [
        migrations.RunPython(
            create_web_push_table_if_missing,
            reverse_code=drop_web_push_table_if_exists,
        ),
    ]

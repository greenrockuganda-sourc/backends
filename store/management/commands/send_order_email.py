from django.core.management.base import BaseCommand, CommandError
from django.conf import settings

from store.models import Order
from store.views import _send_order_status_email


class Command(BaseCommand):
    help = 'Render or send order status email for a given order id (use --live to actually send)'

    def add_arguments(self, parser):
        parser.add_argument('order_id', type=int, help='Order id to render/send email for')
        parser.add_argument('--live', action='store_true', help='Actually send the email via configured SMTP')

    def handle(self, *args, **options):
        order_id = options['order_id']
        live = options['live']

        try:
            order = Order.objects.select_related('customer__user').get(pk=order_id)
        except Order.DoesNotExist:
            raise CommandError(f'Order with id {order_id} does not exist')

        # If not live, force console backend so we can inspect the rendered email without sending
        original_backend = getattr(settings, 'EMAIL_BACKEND', None)
        if not live:
            try:
                settings.EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
            except Exception:
                pass

        try:
            sent = _send_order_status_email(order, f'[Test] Order update: {order.order_number}', 'This is a test email from management command')
            self.stdout.write(self.style.SUCCESS(f'Email send helper returned: {sent}'))
        except Exception as exc:
            raise CommandError(f'Error sending/rendering email: {exc}')
        finally:
            if not live and original_backend is not None:
                try:
                    settings.EMAIL_BACKEND = original_backend
                except Exception:
                    pass

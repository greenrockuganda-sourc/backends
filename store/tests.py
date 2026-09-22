import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.management import call_command
from django.db import ProgrammingError
from django.template.loader import render_to_string
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from backend import settings as backend_settings
from .models import Brand, Category, Customer, Delivery, Notification, Order, OrderItem, Product, Receipt, Recipe
from .views import generate_product_sku
import os

User = get_user_model()


class EmailConfigTests(TestCase):
    def test_resolve_email_backend_uses_console_when_smtp_credentials_missing(self):
        with patch.dict('os.environ', {
            'EMAIL_BACKEND': '',
            'EMAIL_HOST_USER': '',
            'EMAIL_HOST_PASSWORD': '',
        }, clear=False):
            self.assertEqual(
                backend_settings.resolve_email_backend(),
                'django.core.mail.backends.console.EmailBackend',
            )

    def test_resolve_email_backend_uses_smtp_when_credentials_are_present(self):
        with patch.dict('os.environ', {
            'EMAIL_BACKEND': '',
            'EMAIL_HOST_USER': 'mail@example.com',
            'EMAIL_HOST_PASSWORD': 'secret',
        }, clear=False):
            self.assertEqual(
                backend_settings.resolve_email_backend(),
                'django.core.mail.backends.smtp.EmailBackend',
            )

    def test_resolve_email_backend_ignores_multiline_env_values(self):
        with patch.dict('os.environ', {
            'EMAIL_BACKEND': 'django.core.mail.backends.smtp.EmailBackend\nEMAIL_HOST=smtp-relay.brevo.com',
            'EMAIL_HOST_USER': 'mail@example.com',
            'EMAIL_HOST_PASSWORD': 'secret',
        }, clear=False):
            self.assertEqual(
                backend_settings.resolve_email_backend(),
                'django.core.mail.backends.smtp.EmailBackend',
            )

    @override_settings(
        BREVO_API_KEY='test-brevo-api-key',
        DEFAULT_FROM_EMAIL='Glow <noreply@example.com>',
    )
    @patch('store.views.urlopen')
    def test_brevo_https_api_sends_a_private_email_per_recipient(self, mock_urlopen):
        mock_urlopen.return_value.status = 201
        from store.views import _send_brevo_api_message, _send_email_campaign_messages

        self.assertTrue(_send_brevo_api_message(
            'one@example.com',
            'Test subject',
            '<p>Test body</p>',
        ))
        sent = _send_email_campaign_messages(
            ['one@example.com', 'two@example.com'],
            'Campaign subject',
            '<p>Campaign body</p>',
        )

        self.assertEqual(sent, 2)
        self.assertEqual(mock_urlopen.call_count, 2)
        single_payload = json.loads(mock_urlopen.call_args_list[0].args[0].data.decode('utf-8'))
        campaign_payload = json.loads(mock_urlopen.call_args_list[1].args[0].data.decode('utf-8'))
        self.assertEqual(single_payload['to'], [{'email': 'one@example.com'}])
        self.assertEqual(campaign_payload['messageVersions'], [
            {'to': [{'email': 'one@example.com'}]},
            {'to': [{'email': 'two@example.com'}]},
        ])


class ConnectivityConfigTests(TestCase):
    def test_parse_origin_list_includes_env_and_local_defaults(self):
        value = 'https://app.example.com, http://localhost:5173'
        parsed = backend_settings.parse_csv_env(value, default_values=[
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:5173',
            'http://127.0.0.1:5173',
        ])
        self.assertIn('https://app.example.com', parsed)
        self.assertIn('http://localhost:5173', parsed)
        self.assertIn('http://localhost:3000', parsed)
        self.assertEqual(len(parsed), len(set(parsed)))


class RegistrationRoleTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_customer_app_registration_defaults_to_customer_role(self):
        response = self.client.post(
            reverse('register'),
            {
                'first_name': 'Jane',
                'last_name': 'Customer',
                'email': 'customer-app@example.com',
                'phone_number': '+256700000001',
                'password': 'StrongPass123!',
                'salon_name': 'Glow App Studio',
                'location': 'Kampala, Uganda',
            },
            format='json',
            HTTP_X_CLIENT_TYPE='customer',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['user']['role'], 'Customer')
        self.assertTrue(Customer.objects.filter(user__email='customer-app@example.com').exists())

    def test_customer_registration_allows_missing_location(self):
        response = self.client.post(
            reverse('register'),
            {
                'first_name': 'Noel',
                'last_name': 'Customer',
                'email': 'customer-nolocation@example.com',
                'phone_number': '+256700000003',
                'password': 'StrongPass123!',
                'salon_name': 'Glow No Location Studio',
            },
            format='json',
            HTTP_X_CLIENT_TYPE='customer',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['user']['role'], 'Customer')
        self.assertTrue(Customer.objects.filter(user__email='customer-nolocation@example.com').exists())


class PushSubscriptionAndBroadcastTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_subscribe_and_broadcast_web_push(self):
        # Post a dummy web push subscription (anonymous allowed)
        subscription = {
            'subscription': {
                'endpoint': 'https://example.com/push/abc123',
                'keys': {
                    'p256dh': 'BKey',
                    'auth': 'AuthKey',
                }
            }
        }

        resp = self.client.post(reverse('push_subscribe'), subscription, format='json')
        self.assertIn(resp.status_code, (200, 201))

        # Confirm subscription was stored
        from .models import WebPushSubscription
        self.assertTrue(WebPushSubscription.objects.filter(endpoint='https://example.com/push/abc123').exists())

        # Create an admin user to trigger broadcast
        admin_user = User.objects.create_user(
            email='admin-broadcast@example.com',
            password='StrongPass123!',
            first_name='Admin',
            last_name='Broadcast',
            phone_number='0709999000',
            is_staff=True,
            is_superuser=True,
            role='Admin',
        )
        token = str(RefreshToken.for_user(admin_user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        # Ensure VAPID keys are present in env for send_web_push to proceed in tests
        with patch.dict(os.environ, {'VAPID_PUBLIC_KEY': 'test_pub', 'VAPID_PRIVATE_KEY': 'test_priv'}, clear=False):
            # Ensure a dummy pywebpush module exists (test env may not have it)
            import sys
            from types import ModuleType
            if 'pywebpush' not in sys.modules:
                mod = ModuleType('pywebpush')
                mod.webpush = lambda *a, **k: None
                mod.WebPushException = Exception
                sys.modules['pywebpush'] = mod

            # Patch network push senders to avoid external calls
            with patch('pywebpush.webpush', return_value=None) as mock_webpush, patch('store.views.urlopen') as mock_urlopen:
                # urlopen should be callable and return an object with read()
                class DummyResp:
                    def read(self):
                        return b'[]'

                mock_urlopen.return_value = DummyResp()

                payload = {'title': 'Test Broadcast', 'message': 'Hello subscribers!'}
                broadcast_resp = self.client.post(reverse('broadcast_notifications'), payload, format='json')
                self.assertEqual(broadcast_resp.status_code, 200)
                self.assertIn('recipients', broadcast_resp.data)
                # Ensure our mock was called for web-push path
                self.assertTrue(mock_webpush.called)

    def test_push_send_handles_missing_web_push_table_gracefully(self):
        admin_user = User.objects.create_user(
            email='admin-push-send@example.com',
            password='StrongPass123!',
            first_name='Admin',
            last_name='Push',
            phone_number='0705555001',
            is_staff=True,
            is_superuser=True,
            role='Admin',
        )
        token = str(RefreshToken.for_user(admin_user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        with patch('store.views.WebPushSubscription.objects.all', side_effect=ProgrammingError('relation "web_push_subscriptions" does not exist')):
            resp = self.client.post(reverse('push_send'), {'title': 'Status update', 'message': 'Hello'}, format='json')

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['recipients'], 0)

    def test_dashboard_registration_defaults_to_seller_role(self):
        response = self.client.post(
            reverse('register'),
            {
                'first_name': 'Karl',
                'last_name': 'Seller',
                'email': 'seller-dashboard@example.com',
                'phone_number': '+256700000002',
                'password': 'StrongPass123!',
                'salon_name': 'Greenrock Seller Studio',
            },
            format='json',
            HTTP_X_CLIENT_TYPE='seller',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['user']['role'], 'Seller')
        self.assertFalse(Customer.objects.filter(user__email='seller-dashboard@example.com').exists())


class NotificationSystemTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='customer-notify@example.com',
            password='StrongPass123!',
            first_name='Jane',
            last_name='Customer',
            phone_number='+256700000020',
            role='Customer',
        )
        self.client.force_authenticate(user=self.user)

    def test_user_notifications_api_tracks_read_state_and_categories(self):
        notification = Notification.objects.create(
            user=self.user,
            title='Order update',
            message='Your delivery is on the way.',
            notification_type='delivery_status',
            channels=['in_app', 'push'],
            is_read=False,
        )

        response = self.client.get(reverse('user_notifications'))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(len(response.data) >= 1)
        payload = response.data[0]
        self.assertEqual(payload['notification_type'], 'delivery_status')
        self.assertIn('channels', payload)
        self.assertFalse(payload['is_read'])

        mark_response = self.client.patch(
            reverse('user_notification_read', kwargs={'notification_id': notification.id}),
            {'is_read': True},
            format='json',
        )
        self.assertEqual(mark_response.status_code, 200)
        notification.refresh_from_db()
        self.assertTrue(notification.is_read)
        self.assertIsNotNone(notification.read_at)

    def test_notification_campaign_supports_multiple_channels(self):
        with patch('store.views._send_email_message', return_value=True) as mock_email, patch('store.views.send_web_push', return_value=True) as mock_push, patch('store.views.PushToken.objects.filter') as mock_filter, patch('store.views.WebPushSubscription.objects.all'):
            token_obj = type('Token', (), {'token': 'ExponentPushToken[abc]', 'user': self.user})()
            mock_filter.return_value.values_list.return_value.distinct.return_value = ['ExponentPushToken[abc]']

            response = self.client.post(reverse('user_notification_campaign'), {
                'title': 'New product arrival',
                'message': 'Your favorite serum is back in stock.',
                'notification_type': 'product_restock',
                'channels': ['in_app', 'push', 'email'],
            }, format='json')

            self.assertEqual(response.status_code, 200)
            self.assertEqual(Notification.objects.filter(user=self.user, notification_type='product_restock').count(), 1)
            self.assertTrue(mock_email.called)
            self.assertTrue(mock_push.called)


class ProductSkuGenerationTests(TestCase):
    def test_generate_product_sku_from_name(self):
        self.assertEqual(generate_product_sku('Glow Hair Serum'), 'SKU-GLOW-HAIR-SERUM')

    def test_generate_product_sku_avoids_duplicate_values(self):
        category = Category.objects.create(category_name='Hair Care')
        brand = Brand.objects.create(brand_name='Glow')
        Product.objects.create(
            category=category,
            brand=brand,
            product_name='Glow Hair Serum',
            buying_price=5000,
            selling_price=8000,
            quantity_in_stock=3,
            sku='SKU-GLOW-HAIR-SERUM',
        )

        self.assertEqual(generate_product_sku('Glow Hair Serum'), 'SKU-GLOW-HAIR-SERUM-2')


class ReportEmailAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_admin_can_queue_report_email(self):
        admin_user = User.objects.create_user(
            email='admin@example.com',
            password='StrongPass123!',
            first_name='Admin',
            last_name='User',
            phone_number='0705555000',
            is_staff=True,
            is_superuser=True,
            role='Admin',
        )
        token = str(RefreshToken.for_user(admin_user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        response = self.client.post(reverse('admin_reports', kwargs={'report_type': 'sales'}), {
            'email': 'ops@example.com',
            'frequency': 'weekly',
            'start_date': '2024-01-01',
            'end_date': '2024-01-31',
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['message'], 'Report email queued.')
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Weekly Sales Report', mail.outbox[0].subject)


class AdminDataFieldAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_user = User.objects.create_user(
            email='admin@example.com',
            password='StrongPass123!',
            first_name='Admin',
            last_name='User',
            phone_number='0700000000',
            role='Admin',
            is_staff=True,
            is_superuser=True,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(RefreshToken.for_user(self.admin_user).access_token)}")

        self.customer_user = User.objects.create_user(
            email='salon@example.com',
            password='StrongPass123!',
            first_name='Nina',
            last_name='Client',
            phone_number='0701234567',
            role='Customer',
        )
        self.customer = Customer.objects.create(
            user=self.customer_user,
            salon_name='Glow Studio',
            address='Kampala, Ntinda',
            district='Kampala',
            city='Kampala',
        )
        self.order = Order.objects.create(
            customer=self.customer,
            order_number='ORD-TEST-001',
            total_amount=20000,
            delivery_address='Kampala, Ntinda',
            phone_number='0701234567',
            order_status='Pending',
        )
        self.delivery = Delivery.objects.create(
            order=self.order,
            delivery_status='Preparing',
            delivery_person='James Rider',
            delivery_phone='0701111111',
        )
        self.receipt = Receipt.objects.create(
            order=self.order,
            receipt_number='RCPT-TEST-001',
            total_amount=20000,
        )

    def test_admin_list_endpoints_include_salon_name_and_address(self):
        order_response = self.client.get(reverse('admin_orders'))
        self.assertEqual(order_response.status_code, 200)
        self.assertIn('salon_name', order_response.data[0])
        self.assertEqual(order_response.data[0]['salon_name'], 'Glow Studio')
        self.assertEqual(order_response.data[0]['delivery_address'], 'Kampala, Ntinda')

        delivery_response = self.client.get(reverse('admin_deliveries'))
        self.assertEqual(delivery_response.status_code, 200)
        self.assertIn('salon_name', delivery_response.data[0])
        self.assertEqual(delivery_response.data[0]['salon_name'], 'Glow Studio')
        self.assertEqual(delivery_response.data[0]['address'], 'Kampala, Ntinda')

        receipt_response = self.client.get(reverse('admin_receipts'))
        self.assertEqual(receipt_response.status_code, 200)
        self.assertIn('salon_name', receipt_response.data[0])
        self.assertEqual(receipt_response.data[0]['salon_name'], 'Glow Studio')
        self.assertEqual(receipt_response.data[0]['address'], 'Kampala, Ntinda')


class AdminStatusCreateAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_user = User.objects.create_user(
            email='admin@example.com',
            password='StrongPass123!',
            first_name='Admin',
            last_name='User',
            phone_number='0700000000',
            role='Admin',
            is_staff=True,
            is_superuser=True,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(RefreshToken.for_user(self.admin_user).access_token)}")

        self.customer_user = User.objects.create_user(
            email='salon@example.com',
            password='StrongPass123!',
            first_name='Nina',
            last_name='Client',
            phone_number='0701234567',
            role='Customer',
        )
        self.customer = Customer.objects.create(
            user=self.customer_user,
            salon_name='Glow Studio',
            address='Kampala, Ntinda',
            district='Kampala',
            city='Kampala',
        )
        self.order = Order.objects.create(
            customer=self.customer,
            order_number='ORD-STATUS-001',
            total_amount=20000,
            delivery_address='Kampala, Ntinda',
            phone_number='0701234567',
            order_status='Pending',
        )

    def test_status_update_creates_delivery_when_missing(self):
        self.assertFalse(hasattr(self.order, 'delivery'))

        response = self.client.patch(reverse('admin_update_order_status', kwargs={'order_id': self.order.id}), {
            'status': 'Delivered',
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.order_status, 'Delivered')
        self.assertTrue(hasattr(self.order, 'delivery'))
        self.assertEqual(self.order.delivery.delivery_status, 'Delivered')

    def test_new_arrival_broadcast_route_exists_and_creates_notifications(self):
        response = self.client.post(reverse('broadcast_new_arrival_notifications'), {
            'title': 'New Arrival',
            'message': 'New salon products are now available.',
            'notification_type': 'new_arrival',
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(Notification.objects.filter(user=self.customer_user, notification_type='new_arrival').exists())


class CustomerUserAndCampaignAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_user = User.objects.create_user(
            email='admin@example.com',
            password='StrongPass123!',
            first_name='Admin',
            last_name='User',
            phone_number='0700000000',
            role='Admin',
            is_staff=True,
            is_superuser=True,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(RefreshToken.for_user(self.admin_user).access_token)}")

        self.customer_user = User.objects.create_user(
            email='customer@example.com',
            password='StrongPass123!',
            first_name='Jane',
            last_name='Customer',
            phone_number='0701234567',
            role='Customer',
        )
        self.customer = Customer.objects.create(
            user=self.customer_user,
            salon_name='Jane Salon',
            address='Kampala, Ntinda',
            district='Kampala',
            city='Kampala',
        )

    def test_customer_and_user_list_routes_exist_for_admin_and_customer_users(self):
        customer_list = self.client.get(reverse('customers_api'))
        self.assertEqual(customer_list.status_code, 200)
        self.assertIsInstance(customer_list.data, list)

        admin_customer_list = self.client.get(reverse('admin_customers'))
        self.assertEqual(admin_customer_list.status_code, 200)
        self.assertIsInstance(admin_customer_list.data, list)

        admin_user_list = self.client.get(reverse('admin_users_api'))
        self.assertEqual(admin_user_list.status_code, 200)
        self.assertIsInstance(admin_user_list.data, list)

        user_list = self.client.get(reverse('users_api'))
        self.assertEqual(user_list.status_code, 200)
        self.assertIsInstance(user_list.data, list)

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_customer_email_campaign_endpoint_sends_to_valid_recipients(self):
        response = self.client.post(reverse('customer_email_campaign'), {
            'subject': 'New product drop',
            'message': 'Fresh stock has landed.',
            'send_to_all': True,
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.data['sent'], 1)
        self.assertIn('sent', response.data)
        self.assertEqual(len(mail.outbox), 1)

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_customer_email_campaign_accepts_one_or_many_explicit_recipients(self):
        second_user = User.objects.create_user(
            email='second-customer@example.com',
            password='StrongPass123!',
            first_name='Second',
            last_name='Customer',
            phone_number='0701234568',
            role='Customer',
        )

        single_response = self.client.post(reverse('customer_email_campaign'), {
            'subject': 'Single customer update',
            'message': 'A single-recipient campaign.',
            'email': self.customer_user.email,
        }, format='json')

        self.assertEqual(single_response.status_code, 200)
        self.assertEqual(single_response.data['recipients'], 1)
        self.assertEqual(single_response.data['sent'], 1)
        self.assertEqual(single_response.data['failed'], 0)

        multiple_response = self.client.post(reverse('customer_email_campaign'), {
            'subject': 'Multiple customer update',
            'message': 'A multiple-recipient campaign.',
            'recipients': [self.customer_user.email, second_user.email, self.customer_user.email],
        }, format='json')

        self.assertEqual(multiple_response.status_code, 200)
        self.assertEqual(multiple_response.data['recipients'], 2)
        self.assertEqual(multiple_response.data['sent'], 2)
        self.assertEqual(multiple_response.data['failed'], 0)
        self.assertEqual(len(mail.outbox), 3)

        empty_response = self.client.post(reverse('customer_email_campaign'), {
            'subject': 'Do not send',
            'message': 'An empty recipient list must not become an all-customer campaign.',
            'recipients': [],
        }, format='json')

        self.assertEqual(empty_response.status_code, 400)
        self.assertEqual(len(mail.outbox), 3)

    def test_push_broadcast_route_accepts_customer_notifications(self):
        response = self.client.post(reverse('customer_push_broadcast'), {
            'title': 'New arrival',
            'message': 'New salon essentials are here.',
            'notification_type': 'new_arrival',
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.data['recipients'], 1)
        self.assertIn('recipients', response.data)


class AuthAndProfileAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_login_and_profile_flow(self):
        register_url = reverse('register')
        login_url = reverse('login')
        profile_url = reverse('profile')

        register_response = self.client.post(register_url, {
            'first_name': 'Jane',
            'last_name': 'Doe',
            'email': 'jane@example.com',
            'password': 'StrongPass123!',
            'phone_number': '1234567890',
            'salon_name': 'Jane Salon',
            'location': 'Kampala',
        }, format='json')

        self.assertEqual(register_response.status_code, 201)
        self.assertIn('user', register_response.data)
        self.assertIn('access', register_response.data)

        login_response = self.client.post(login_url, {
            'email': 'jane@example.com',
            'password': 'StrongPass123!',
        }, format='json')

        self.assertEqual(login_response.status_code, 200)
        self.assertIn('access', login_response.data)
        self.assertIn('refresh', login_response.data)
        # tokens should be set in HttpOnly cookies
        self.assertIn('access', self.client.cookies)
        self.assertIn('refresh', self.client.cookies)
        access = self.client.cookies['access'].value
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        profile_response = self.client.get(profile_url)

        self.assertEqual(profile_response.status_code, 200)
        self.assertEqual(profile_response.data['email'], 'jane@example.com')

    def test_login_with_phone_number(self):
        self.client.post(reverse('register'), {
            'first_name': 'John',
            'last_name': 'Smith',
            'email': 'john@example.com',
            'password': 'StrongPass123!',
            'phone_number': '9876543210',
            'salon_name': 'John Salon',
            'location': 'Kampala',
        }, format='json')

        login_response = self.client.post(reverse('login'), {
            'phone_number': '9876543210',
            'password': 'StrongPass123!',
        }, format='json')

        self.assertEqual(login_response.status_code, 200)
        self.assertIn('access', self.client.cookies)
        access = self.client.cookies['access'].value

    def test_customer_can_register_with_phone_only_and_salon_details(self):
        response = self.client.post(reverse('register'), {
            'first_name': 'Phone',
            'last_name': 'Only',
            'phone_number': '0700999000',
            'password': 'StrongPass123!',
            'salon_name': 'Glow Phone Salon',
            'location': 'Ntinda, Kampala',
        }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertIn('access', response.data)
        user = User.objects.get(phone_number='0700999000')
        self.assertIsNone(user.email)
        self.assertEqual(user.customer.salon_name, 'Glow Phone Salon')
        self.assertEqual(user.customer.address, 'Ntinda, Kampala')

    def test_password_reset_can_start_with_a_phone_number(self):
        user = User.objects.create_user(
            email='recovery@example.com',
            password='OldPass123!',
            first_name='Recovery',
            last_name='User',
            phone_number='0700888000',
            is_active=True,
        )

        forgot_response = self.client.post(reverse('forgot_password'), {'identifier': user.phone_number}, format='json')

        self.assertEqual(forgot_response.status_code, 200)
        self.assertIn('uid', forgot_response.data)
        self.assertIn('token', forgot_response.data)

        reset_response = self.client.post(reverse('reset_password'), {
            'uid': forgot_response.data['uid'],
            'token': forgot_response.data['token'],
            'new_password': 'NewPass123!',
            'confirm_password': 'NewPass123!',
        }, format='json')

        self.assertEqual(reset_response.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.check_password('NewPass123!'))

    def test_inactive_user_cannot_access_profile(self):
        user = User.objects.create_user(
            email='inactive@example.com',
            password='StrongPass123!',
            first_name='Inactive',
            last_name='User',
            phone_number='5550000000',
            is_active=False,
        )
        token = str(RefreshToken.for_user(user).access_token)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        profile_response = self.client.get(reverse('profile'))

        self.assertEqual(profile_response.status_code, 401)

    def test_save_and_load_recipe(self):
        register_response = self.client.post(reverse('register'), {
            'first_name': 'Cook',
            'last_name': 'Admin',
            'email': 'cook@example.com',
            'password': 'StrongPass123!',
            'phone_number': '0700111223',
            'salon_name': 'Cook Salon',
            'location': 'Kampala',
        }, format='json')
        self.assertEqual(register_response.status_code, 201)

        login_response = self.client.post(reverse('login'), {
            'email': 'cook@example.com',
            'password': 'StrongPass123!',
        }, format='json')
        self.assertEqual(login_response.status_code, 200)

        self.assertIn('access', self.client.cookies)
        access = self.client.cookies['access'].value
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        recipe_payload = {
            'title': 'Hydrating Hair Mask',
            'description': 'A simple mask for soft, shiny hair.',
            'prep_time': '10 mins',
            'servings': '1',
            'ingredients': ['2 tbsp avocado oil', '1 tbsp honey'],
            'steps': ['Mix ingredients.', 'Apply to hair.', 'Rinse after 15 minutes.'],
        }

        save_response = self.client.post(reverse('recipes'), recipe_payload, format='json')
        self.assertEqual(save_response.status_code, 201)
        self.assertEqual(save_response.data['title'], 'Hydrating Hair Mask')

        list_response = self.client.get(reverse('recipes'))
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(list_response.data[0]['title'], 'Hydrating Hair Mask')

    def test_update_saved_recipe(self):
        register_response = self.client.post(reverse('register'), {
            'first_name': 'Cook',
            'last_name': 'Editor',
            'email': 'edit@example.com',
            'password': 'StrongPass123!',
            'phone_number': '0700111224',
            'salon_name': 'Editor Salon',
            'location': 'Kampala',
        }, format='json')
        self.assertEqual(register_response.status_code, 201)

        login_response = self.client.post(reverse('login'), {
            'email': 'edit@example.com',
            'password': 'StrongPass123!',
        }, format='json')
        self.assertEqual(login_response.status_code, 200)
        self.assertIn('access', self.client.cookies)
        access = self.client.cookies['access'].value
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        recipe_payload = {
            'title': 'Softening Serum',
            'description': 'A gentle serum for frizz control.',
            'prep_time': '5 mins',
            'servings': '1',
            'ingredients': ['1 tbsp argan oil', '1 tsp aloe vera'],
            'steps': ['Combine ingredients.', 'Massage into ends.'],
        }

        save_response = self.client.post(reverse('recipes'), recipe_payload, format='json')
        self.assertEqual(save_response.status_code, 201)

        recipe_id = save_response.data['id']
        update_payload = {
            'title': 'Softening Serum Plus',
            'servings': '2',
        }

        update_response = self.client.put(reverse('recipe_detail', kwargs={'recipe_id': recipe_id}), update_payload, format='json')
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.data['title'], 'Softening Serum Plus')
        self.assertEqual(update_response.data['servings'], '2')

    def test_delete_saved_recipe(self):
        register_response = self.client.post(reverse('register'), {
            'first_name': 'Cook',
            'last_name': 'Remover',
            'email': 'delete@example.com',
            'password': 'StrongPass123!',
            'phone_number': '0700111225',
            'salon_name': 'Remover Salon',
            'location': 'Kampala',
        }, format='json')
        self.assertEqual(register_response.status_code, 201)

        login_response = self.client.post(reverse('login'), {
            'email': 'delete@example.com',
            'password': 'StrongPass123!',
        }, format='json')
        self.assertEqual(login_response.status_code, 200)
        self.assertIn('access', self.client.cookies)
        access = self.client.cookies['access'].value
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        recipe_payload = {
            'title': 'Temporary Mask',
            'description': 'A short-lived recipe for testing.',
            'prep_time': '3 mins',
            'servings': '1',
            'ingredients': ['1 tbsp shea butter'],
            'steps': ['Heat and apply.'],
        }

        save_response = self.client.post(reverse('recipes'), recipe_payload, format='json')
        self.assertEqual(save_response.status_code, 201)

        recipe_id = save_response.data['id']
        delete_response = self.client.delete(reverse('recipe_detail', kwargs={'recipe_id': recipe_id}))
        self.assertEqual(delete_response.status_code, 204)

        list_response = self.client.get(reverse('recipes'))
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.data), 0)

    def test_cart_and_order_flow(self):
        seller = User.objects.create_user(
            email='seller-order-alert@example.com',
            password='StrongPass123!',
            first_name='Seller',
            last_name='Alert',
            phone_number='0700000010',
            role='Seller',
            is_active=True,
        )
        category = Category.objects.create(category_name='Hair Care')
        brand = Brand.objects.create(brand_name='Glow')
        product = Product.objects.create(
            category=category,
            brand=brand,
            product_name='Shampoo',
            buying_price=1000,
            selling_price=2000,
            quantity_in_stock=5,
            sku='SKU-001',
        )

        cart_response = self.client.post(reverse('cart_add'), {
            'product_id': product.id,
            'quantity': 2,
        }, HTTP_X_SESSION_ID='guest-cart-1')
        self.assertEqual(cart_response.status_code, 200)

        register_response = self.client.post(reverse('register'), {
            'first_name': 'Alice',
            'last_name': 'K',
            'email': 'alice@example.com',
            'password': 'StrongPass123!',
            'phone_number': '0700000001',
            'salon_name': 'Alice Salon',
            'location': 'Kampala',
        }, format='json')
        self.assertEqual(register_response.status_code, 201)

        login_response = self.client.post(reverse('login'), {
            'email': 'alice@example.com',
            'password': 'StrongPass123!',
        }, format='json')
        self.assertEqual(login_response.status_code, 200)

        self.assertIn('access', self.client.cookies)
        access = self.client.cookies['access'].value
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        merge_response = self.client.post(reverse('cart_merge'), {'session_id': 'guest-cart-1'})
        self.assertEqual(merge_response.status_code, 200)

        with patch('store.views._send_user_push_notifications', return_value={'expo_sent': 0, 'web_sent': 1}) as mock_push:
            with self.captureOnCommitCallbacks(execute=True):
                order_response = self.client.post(reverse('create_order'), {
                    'delivery_address': 'Kampala',
                    'phone_number': '0700000001',
                    'payment_method': 'PAY_ON_DELIVERY',
                }, format='json')
        self.assertEqual(order_response.status_code, 201)
        self.assertEqual(Order.objects.count(), 1)

        order = Order.objects.get(order_number=order_response.data['order']['order_number'])
        self.assertEqual(order.order_status, 'Pending')
        self.assertEqual(order.delivery.delivery_status, 'Preparing')
        seller_notification = Notification.objects.filter(user=seller, notification_type='order').first()
        self.assertIsNotNone(seller_notification)
        self.assertEqual(seller_notification.channels, ['in_app', 'push'])
        mock_push.assert_called_once()
        self.assertIn(seller.id, mock_push.call_args.args[0])

    def test_order_creation_auto_generates_a_receipt(self):
        category = Category.objects.create(category_name='Hair Care')
        brand = Brand.objects.create(brand_name='Glow')
        product = Product.objects.create(
            category=category,
            brand=brand,
            product_name='Conditioner',
            buying_price=1200,
            selling_price=2500,
            quantity_in_stock=4,
            sku='SKU-003',
        )

        user = User.objects.create_user(
            email='receipt-user@example.com',
            password='StrongPass123!',
            first_name='Receipt',
            last_name='User',
            phone_number='0700000004',
            is_active=True,
        )
        token = str(RefreshToken.for_user(user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        cart_response = self.client.post(reverse('cart_add'), {
            'product_id': product.id,
            'quantity': 1,
        }, format='json')
        self.assertEqual(cart_response.status_code, 200)

        order_response = self.client.post(reverse('create_order'), {
            'delivery_address': 'Kampala',
            'phone_number': '0700000004',
            'payment_method': 'PAY_ON_DELIVERY',
        }, format='json')
        self.assertEqual(order_response.status_code, 201)

        order = Order.objects.get(order_number=order_response.data['order']['order_number'])
        self.assertTrue(Receipt.objects.filter(order=order).exists())
        receipt = Receipt.objects.get(order=order)
        self.assertTrue(receipt.receipt_number)
        self.assertEqual(receipt.total_amount, order.total_amount + order.delivery_fee + order.tax)

    def test_order_list_includes_item_images(self):
        category = Category.objects.create(category_name='Hair Care')
        brand = Brand.objects.create(brand_name='Glow')
        product = Product.objects.create(
            category=category,
            brand=brand,
            product_name='Conditioner',
            buying_price=1200,
            selling_price=2500,
            quantity_in_stock=4,
            sku='SKU-002',
            image_url='https://example.com/conditioner.jpg',
        )

        user = User.objects.create_user(
            email='images@example.com',
            password='StrongPass123!',
            first_name='Image',
            last_name='User',
            phone_number='0700000002',
            is_active=True,
        )
        token = str(RefreshToken.for_user(user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        cart_response = self.client.post(reverse('cart_add'), {
            'product_id': product.id,
            'quantity': 1,
        }, format='json')
        self.assertEqual(cart_response.status_code, 200)

        order_response = self.client.post(reverse('create_order'), {
            'delivery_address': 'Kampala',
            'phone_number': '0700000002',
            'payment_method': 'PAY_ON_DELIVERY',
        }, format='json')
        self.assertEqual(order_response.status_code, 201)

        list_response = self.client.get(reverse('orders'))
        self.assertEqual(list_response.status_code, 200)
        self.assertTrue(list_response.data[0]['image_urls'])
        self.assertEqual(list_response.data[0]['items'][0]['image_url'], product.image_url)


class PublicCatalogAPITests(TestCase):
    def test_catalog_includes_out_of_stock_products(self):
        category = Category.objects.create(category_name='Hair Care')
        brand = Brand.objects.create(brand_name='Glow')
        available = Product.objects.create(
            category=category, brand=brand, product_name='Available Shampoo',
            buying_price='5000', selling_price='9000', quantity_in_stock=4,
            sku='AVAILABLE-SHAMPOO', status='Available',
        )
        unavailable = Product.objects.create(
            category=category, brand=brand, product_name='Unavailable Conditioner',
            buying_price='5000', selling_price='9000', quantity_in_stock=0,
            sku='UNAVAILABLE-CONDITIONER', status='Out of Stock',
        )

        response = APIClient().get(reverse('public_product_catalog'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual({item['id'] for item in response.data['results']}, {available.id, unavailable.id})


class AdminDashboardAndProductAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_user = User.objects.create_user(
            email='admin@example.com',
            password='StrongPass123!',
            first_name='Admin',
            last_name='User',
            role='Admin',
            is_active=True,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(RefreshToken.for_user(self.admin_user).access_token)}")

    def test_category_and_brand_endpoints_return_ids_for_inventory_ui(self):
        category = Category.objects.create(category_name='Hair Tools')
        brand = Brand.objects.create(brand_name='StyleCo')

        categories_response = self.client.get(reverse('categories'))
        brands_response = self.client.get(reverse('brands'))

        self.assertEqual(categories_response.status_code, 200)
        self.assertEqual(brands_response.status_code, 200)
        self.assertTrue(any(item['id'] == category.id for item in categories_response.data))
        self.assertTrue(any(item['id'] == brand.id for item in brands_response.data))

    def test_seller_can_access_products_endpoint(self):
        seller = User.objects.create_user(
            email='seller@example.com',
            password='StrongPass123!',
            first_name='Seller',
            last_name='User',
            role='Seller',
            is_active=True,
        )
        seller_client = APIClient()
        seller_client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(RefreshToken.for_user(seller).access_token)}")

        response = seller_client.get(reverse('products'))

        self.assertEqual(response.status_code, 200)

    def test_dashboard_and_product_crud_flow(self):
        category = Category.objects.create(category_name='Hair Products')
        brand = Brand.objects.create(brand_name='Luxe')

        list_response = self.client.get(reverse('products'))
        self.assertEqual(list_response.status_code, 200)

        create_response = self.client.post(reverse('products'), {
            'category_id': category.id,
            'brand_id': brand.id,
            'product_name': 'Conditioner',
            'sku': 'SKU-100',
            'buying_price': '1000',
            'selling_price': '2000',
            'quantity_in_stock': 10,
            'reorder_level': 3,
            'status': 'Available',
        }, format='json')
        self.assertEqual(create_response.status_code, 201)

        dashboard_response = self.client.get(reverse('dashboard'))
        self.assertEqual(dashboard_response.status_code, 200)
        self.assertEqual(dashboard_response.data['summary']['total_products'], 1)

    @patch('store.views.EmailMessage')
    def test_order_status_changes_send_customer_emails(self, mock_email_cls):
        customer_user = User.objects.create_user(
            email='customer@example.com',
            password='StrongPass123!',
            first_name='Customer',
            last_name='User',
            role='Customer',
            is_active=True,
        )
        customer = Customer.objects.create(user=customer_user)
        order = Order.objects.create(
            customer=customer,
            order_number='ORD-EMAIL-TEST',
            total_amount='25000',
            payment_method='PAY_ON_DELIVERY',
            order_status='Pending',
            delivery_address='Kampala',
            phone_number='0700000000',
        )

        mock_instance = mock_email_cls.return_value

        confirm_response = self.client.patch(reverse('admin_confirm_order', kwargs={'order_id': order.id}), format='json')
        self.assertEqual(confirm_response.status_code, 200)

        status_response = self.client.patch(reverse('admin_update_order_status', kwargs={'order_id': order.id}), {'status': 'Out for Delivery'}, format='json')
        self.assertEqual(status_response.status_code, 200)

        delivered_response = self.client.patch(reverse('admin_update_order_status', kwargs={'order_id': order.id}), {'status': 'Delivered'}, format='json')
        self.assertEqual(delivered_response.status_code, 200)

        self.assertGreaterEqual(mock_instance.send.call_count, 3)
        self.assertEqual(mock_email_cls.call_args_list[0].kwargs['to'], [customer_user.email])

    @patch('store.views.EmailMessage')
    def test_cancelled_orders_send_customer_email_notification(self, mock_email_cls):
        customer_user = User.objects.create_user(
            email='customer-cancel@example.com',
            password='StrongPass123!',
            first_name='Cancel',
            last_name='Customer',
            role='Customer',
            is_active=True,
        )
        customer = Customer.objects.create(user=customer_user)
        order = Order.objects.create(
            customer=customer,
            order_number='ORD-CANCEL-EMAIL',
            total_amount='12000',
            payment_method='PAY_ON_DELIVERY',
            order_status='Confirmed',
            delivery_address='Kampala',
            phone_number='0700000001',
        )
        OrderItem.objects.create(
            order=order,
            product=Product.objects.create(
                category=Category.objects.create(category_name='Cancellation Items'),
                brand=Brand.objects.create(brand_name='Cancel Brand'),
                product_name='Cancelled Product',
                buying_price='1000',
                selling_price='1200',
                quantity_in_stock=3,
                sku='SKU-CANCEL-EMAIL',
            ),
            product_name='Cancelled Product',
            quantity=1,
            unit_price='12000',
            subtotal='12000',
        )

        customer_client = APIClient()
        customer_client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(RefreshToken.for_user(customer_user).access_token)}")

        response = customer_client.patch(reverse('cancel_order', kwargs={'order_id': order.id}), format='json')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(mock_email_cls.called)
        self.assertEqual(mock_email_cls.call_args.kwargs['to'], [customer_user.email])


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class AdminReceiptPDFAndEmailTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_user = User.objects.create_user(
            email='receipt-admin@example.com',
            password='StrongPass123!',
            first_name='Receipt',
            last_name='Admin',
            role='Admin',
            is_active=True,
            is_staff=True,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(RefreshToken.for_user(self.admin_user).access_token)}")

    def create_test_receipt(self):
        category = Category.objects.create(category_name='Receipt Products')
        brand = Brand.objects.create(brand_name='Receipt Brand')
        product = Product.objects.create(
            category=category,
            brand=brand,
            product_name='Salon Oil',
            buying_price='500',
            selling_price='1500',
            quantity_in_stock=10,
            sku='SKU-RECEIPT-01',
        )
        user = User.objects.create_user(
            email='customer@example.com',
            password='StrongPass123!',
            first_name='Customer',
            last_name='Example',
            role='Customer',
            is_active=True,
        )
        customer = Customer.objects.create(user=user)
        order = Order.objects.create(
            customer=customer,
            order_number='ORDER-1234',
            total_amount='1500',
            delivery_fee='0',
            discount='0',
            tax='0',
            payment_method='PAY_ON_DELIVERY',
            payment_status='Paid',
            order_status='Confirmed',
            delivery_address='123 Salon Street',
            phone_number='0700000003',
        )
        OrderItem.objects.create(
            order=order,
            product=product,
            product_name=product.product_name,
            quantity=1,
            unit_price='1500',
            subtotal='1500',
        )
        receipt = Receipt.objects.create(
            order=order,
            receipt_number='REC-1234',
            subtotal='1500',
            tax='0',
            delivery_fee='0',
            total_amount='1500',
        )
        return receipt

    def test_admin_can_download_receipt_pdf(self):
        receipt = self.create_test_receipt()
        response = self.client.get(reverse('admin_receipt_pdf', kwargs={'receipt_id': receipt.id}))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertIn(f'filename="{receipt.receipt_number}.pdf"', response['Content-Disposition'])
        content = b''.join(response.streaming_content)
        self.assertTrue(content)

    def test_receipt_download_returns_pdf_for_customer(self):
        receipt = self.create_test_receipt()
        response = self.client.get(reverse('receipt_download', kwargs={'receipt_id': receipt.id}))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertIn(f'filename="{receipt.receipt_number}.pdf"', response['Content-Disposition'])
        content = b''.join(response.streaming_content)
        self.assertTrue(content)

    def test_admin_can_send_receipt_email_with_attachment(self):
        receipt = self.create_test_receipt()
        response = self.client.post(
            reverse('admin_receipt_email', kwargs={'receipt_id': receipt.id}),
            {'email': 'customer@example.com'},
            format='json',
        )

        

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['message'], 'Email sent.')
        self.assertTrue(response.data.get('pdf_url'))
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertEqual(email.to, ['customer@example.com'])
        self.assertEqual(email.subject, f'Receipt {receipt.receipt_number}')
        self.assertEqual(len(email.attachments), 1)
        self.assertTrue(str(receipt.receipt_number) in email.attachments[0][0])

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_order_confirmation_email_uses_template_and_customer_address(self):
        customer_user = User.objects.create_user(
            email='joshuajessey3@gmail.com',
            password='StrongPass123!',
            first_name='Joshua',
            last_name='Jessey',
            role='Customer',
            is_active=True,
        )
        customer = Customer.objects.create(user=customer_user)
        order = Order.objects.create(
            customer=customer,
            order_number='ORD-TEMPLATE-EMAIL',
            total_amount='25000',
            payment_method='PAY_ON_DELIVERY',
            order_status='Pending',
            delivery_address='Kampala',
            phone_number='0700000000',
        )

        subject, message = __import__('store.views', fromlist=['_build_order_status_message'])._build_order_status_message(order, 'Confirmed')
        sent = __import__('store.views', fromlist=['_send_order_status_email'])._send_order_status_email(order, subject, message)

        self.assertTrue(sent)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['joshuajessey3@gmail.com'])
        self.assertIn('Track your order', mail.outbox[0].body)

    def test_order_status_email_intro_changes_by_status(self):
        status_messages = {
            'Confirmed': 'We’ve received your order and it’s been confirmed and is being prepared for dispatch.',
            'Processing': 'Your order is now being processed and prepared for dispatch.',
            'Out for Delivery': 'Your order is out for delivery and on its way to you.',
            'Delivered': 'Your order has been delivered successfully. Thank you for shopping with Glow.',
        }

        for status, expected_text in status_messages.items():
            rendered = render_to_string('email/order_confirmation_email.html', {
                'customer_name': 'Joshua Jessey',
                'message': expected_text,
                'order_number': 'ORD-20260920190027-1',
                'tracking_url': 'https://example.com/track/ORD-20260920190027-1',
                'company_name': 'Glow',
                'order_status': status,
                'order_date': '2026-09-20 19:00:27',
                'estimated_delivery_date': '20 Sep 2026, 07:00 PM',
                'shipping_address': 'Kampala, Uganda',
                'order_items': [],
                'subtotal': 0,
                'shipping_fee': 0,
                'total_amount': 0,
                'support_phone': '0746998111 / 0772616736',
                'support_email': 'glowsalonsupplies24@gmail.com',
            })
            self.assertIn(expected_text, rendered)
            self.assertIn(status, rendered)
            self.assertIn('20 Sep 2026, 07:00 PM', rendered)

class HomeCatalogSeedTests(TestCase):
    def test_seed_home_catalog_creates_products_for_each_category(self):
        call_command('seed_home_catalog', verbosity=0)

        expected_categories = ['Hair Care', 'Hair Tools', 'Styling', 'Barber', 'Accessories', 'Beauty', 'Makeup', 'Nails']
        existing_categories = set(Category.objects.values_list('category_name', flat=True))

        for category_name in expected_categories:
            self.assertIn(category_name, existing_categories)

        self.assertGreaterEqual(Product.objects.count(), 8)

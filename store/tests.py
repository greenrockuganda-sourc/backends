from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Brand, Category, Customer, Delivery, Order, OrderItem, Product, Receipt, Recipe
from .views import build_receipt_context, generate_product_sku

User = get_user_model()


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

    def test_admin_can_fetch_category_report(self):
        admin_user = User.objects.create_user(
            email='admin2@example.com',
            password='StrongPass123!',
            first_name='Admin',
            last_name='Reports',
            phone_number='0706666000',
            is_staff=True,
            is_superuser=True,
            role='Admin',
        )
        token = str(RefreshToken.for_user(admin_user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        category = Category.objects.create(category_name='Hair Care')
        brand = Brand.objects.create(brand_name='Glow')
        customer = Customer.objects.create(
            user=User.objects.create_user(
                email='customer@example.com',
                password='StrongPass123!',
                first_name='Marta',
                last_name='Doe',
                phone_number='0707777000',
                is_active=True,
            ),
            salon_name='Marta Salon',
        )
        product = Product.objects.create(
            category=category,
            brand=brand,
            product_name='Hair Serum',
            buying_price='5000',
            selling_price='8000',
            quantity_in_stock=10,
            sku='SKU-HAIR-SERUM',
            barcode='BARCODE-HAIR-SERUM',
        )
        order = Order.objects.create(
            customer=customer,
            order_number='ORD-CAT-1001',
            total_amount='8000.00',
            delivery_fee='1000.00',
            tax='400.00',
            order_status='Delivered',
            payment_status='Paid',
        )
        OrderItem.objects.create(
            order=order,
            product=product,
            product_name='Hair Serum',
            quantity=1,
            unit_price='8000.00',
            subtotal='8000.00',
        )

        response = self.client.get(reverse('admin_reports', kwargs={'report_type': 'categories'}))

        self.assertEqual(response.status_code, 200)
        self.assertIn('categories', response.data)
        self.assertGreaterEqual(len(response.data['categories']), 1)
        self.assertEqual(response.data['categories'][0]['category_name'], 'Hair Care')
        self.assertGreaterEqual(float(response.data['categories'][0]['total_revenue']), 8000.0)


class AdminReceiptListAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_admin_receipt_list_includes_item_details(self):
        admin_user = User.objects.create_user(
            email='admin.receipts@example.com',
            password='StrongPass123!',
            first_name='Admin',
            last_name='Receipts',
            phone_number='0708888000',
            is_staff=True,
            is_superuser=True,
            role='Admin',
        )
        token = str(RefreshToken.for_user(admin_user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        category = Category.objects.create(category_name='Hair Care')
        brand = Brand.objects.create(brand_name='Glow')
        customer = Customer.objects.create(
            user=User.objects.create_user(
                email='receipt.customer@example.com',
                password='StrongPass123!',
                first_name='Sarah',
                last_name='Nansubuga',
                phone_number='0709999000',
                is_active=True,
            ),
            salon_name='Glow Studio',
        )
        product = Product.objects.create(
            category=category,
            brand=brand,
            product_name='Hair Serum',
            buying_price='5000',
            selling_price='2500',
            quantity_in_stock=8,
            sku='SKU-RECEIPT-ITEM',
            barcode='BARCODE-RECEIPT-ITEM',
        )
        order = Order.objects.create(
            customer=customer,
            order_number='ORD-RECEIPT-1001',
            total_amount='2500.00',
            delivery_fee='0.00',
            tax='0.00',
            order_status='Delivered',
            payment_status='Paid',
        )
        OrderItem.objects.create(
            order=order,
            product=product,
            product_name='Hair Serum',
            quantity=1,
            unit_price='2500.00',
            subtotal='2500.00',
        )
        receipt = Receipt.objects.create(
            order=order,
            receipt_number='REC-TEST-001',
            total_amount='2500.00',
        )

        response = self.client.get(reverse('admin_receipts'))

        self.assertEqual(response.status_code, 200)
        self.assertIn('items', response.data[0])
        self.assertEqual(response.data[0]['items'][0]['product_name'], 'Hair Serum')
        self.assertEqual(response.data[0]['items'][0]['quantity'], 1)
        self.assertEqual(float(response.data[0]['items'][0]['unit_price']), 2500.0)
        self.assertEqual(float(response.data[0]['items'][0]['subtotal']), 2500.0)
        self.assertEqual(response.data[0]['id'], receipt.id)


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

    @patch('store.views.urlopen')
    @patch('store.views.EmailMessage')
    def test_seller_product_status_updates_send_sms_and_email(self, mock_email_cls, mock_urlopen):
        seller = User.objects.create_user(
            email='seller@example.com',
            password='StrongPass123!',
            first_name='Seller',
            last_name='User',
            role='Seller',
            phone_number='0701234567',
            is_active=True,
        )
        seller_client = APIClient()
        seller_client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(RefreshToken.for_user(seller).access_token)}")

        category = Category.objects.create(category_name='Seller Products')
        brand = Brand.objects.create(brand_name='Seller Brand')
        product = Product.objects.create(
            category=category,
            brand=brand,
            product_name='Hair Serum',
            buying_price='500',
            selling_price='1500',
            quantity_in_stock=3,
            reorder_level=2,
            sku='SKU-SELLER-STATUS',
            status='Available',
        )

        mock_urlopen.return_value.__enter__.return_value.status = 200
        mock_instance = mock_email_cls.return_value

        with self.settings(TWILIO_ACCOUNT_SID='test_sid', TWILIO_AUTH_TOKEN='test_token', TWILIO_PHONE_NUMBER='+15551234567'):
            response = seller_client.patch(reverse('product_detail', kwargs={'product_id': product.id}), {'status': 'Out of Stock'}, format='json')

        self.assertEqual(response.status_code, 200)
        product.refresh_from_db()
        self.assertEqual(product.status, 'Out of Stock')
        self.assertTrue(mock_urlopen.called)
        self.assertGreaterEqual(mock_instance.send.call_count, 1)
        self.assertIn([seller.email], [call.kwargs['to'] for call in mock_email_cls.call_args_list])

    @patch('store.views.urlopen')
    @patch('store.views.EmailMessage')
    def test_seller_can_broadcast_email_and_sms_to_all_customers(self, mock_email_cls, mock_urlopen):
        seller = User.objects.create_user(
            email='seller.broadcast@example.com',
            password='StrongPass123!',
            first_name='Seller',
            last_name='Broadcast',
            role='Seller',
            phone_number='0702222000',
            is_active=True,
        )
        seller_client = APIClient()
        seller_client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(RefreshToken.for_user(seller).access_token)}")

        customer_one = User.objects.create_user(
            email='cust1@example.com',
            password='StrongPass123!',
            first_name='Customer',
            last_name='One',
            role='Customer',
            phone_number='0700000001',
            is_active=True,
        )
        customer_two = User.objects.create_user(
            email='cust2@example.com',
            password='StrongPass123!',
            first_name='Customer',
            last_name='Two',
            role='Customer',
            phone_number='0700000002',
            is_active=True,
        )
        Customer.objects.create(user=customer_one)
        Customer.objects.create(user=customer_two)

        mock_urlopen.return_value.__enter__.return_value.status = 200
        mock_instance = mock_email_cls.return_value

        with self.settings(TWILIO_ACCOUNT_SID='test_sid', TWILIO_AUTH_TOKEN='test_token', TWILIO_PHONE_NUMBER='+15551234567'):
            response = seller_client.post(reverse('broadcast_notifications'), {
                'title': 'Glow store update',
                'message': 'New arrivals are now available.',
                'channel': 'both',
            }, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['recipients'], 2)
        self.assertTrue(mock_urlopen.called)
        self.assertGreaterEqual(mock_instance.send.call_count, 2)
        sent_recipients = [call.kwargs['to'][0] for call in mock_email_cls.call_args_list]
        self.assertIn(customer_one.email, sent_recipients)
        self.assertIn(customer_two.email, sent_recipients)


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

    def test_receipt_qr_code_uses_receipt_number(self):
        receipt = self.create_test_receipt()
        context = build_receipt_context(receipt)

        self.assertEqual(context['qr_code_payload'], f'receipt:{receipt.receipt_number}')
        self.assertIn('data:image/png;base64,', context['qr_code_data_url'])

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

    def test_marking_delivery_as_delivered_updates_order_status(self):
        receipt = self.create_test_receipt()
        delivery = Delivery.objects.create(
            order=receipt.order,
            delivery_status='Out for Delivery',
            delivery_person='Rider Joe',
            delivery_phone='0701111111',
        )

        response = self.client.patch(
            reverse('admin_delivery_detail', kwargs={'delivery_id': delivery.id}),
            {'delivery_status': 'Delivered'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        delivery.refresh_from_db()
        receipt.order.refresh_from_db()
        self.assertEqual(delivery.delivery_status, 'Delivered')
        self.assertEqual(receipt.order.order_status, 'Delivered')

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


class HomeCatalogSeedTests(TestCase):
    def test_seed_home_catalog_creates_products_for_each_category(self):
        call_command('seed_home_catalog', verbosity=0)

        expected_categories = ['Hair Care', 'Hair Tools', 'Styling', 'Barber', 'Accessories', 'Beauty', 'Makeup', 'Nails']
        existing_categories = set(Category.objects.values_list('category_name', flat=True))

        for category_name in expected_categories:
            self.assertIn(category_name, existing_categories)

        self.assertGreaterEqual(Product.objects.count(), 8)

from decimal import Decimal

from django.core.management.base import BaseCommand

from store.models import Brand, Category, Product


class Command(BaseCommand):
    help = 'Seed the home catalog with multiple salon categories and products for the mobile home screen.'

    def handle(self, *args, **options):
        brand, _ = Brand.objects.get_or_create(
            brand_name='Glow Salon',
            defaults={
                'description': 'Premium salon essentials',
                'country': 'Uganda',
                'logo': 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
            },
        )

        catalog = [
            {
                'category_name': 'Hair Care',
                'description': 'Shampoos, conditioners, and premium hair treatment products.',
                'product_name': 'Silk Shine Shampoo',
                'sku': 'SKU-HC-001',
                'buying_price': Decimal('18000.00'),
                'selling_price': Decimal('25000.00'),
                'image_url': 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=800&q=80',
            },
            {
                'category_name': 'Hair Tools',
                'description': 'Professional clippers, brushes, and styling tools.',
                'product_name': 'Pro Clipper Set',
                'sku': 'SKU-HT-001',
                'buying_price': Decimal('120000.00'),
                'selling_price': '165000.00',
                'image_url': 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=800&q=80',
            },
            {
                'category_name': 'Styling',
                'description': 'Sprays, creams, and heat-friendly styling products.',
                'product_name': 'Gloss Finish Spray',
                'sku': 'SKU-ST-001',
                'buying_price': Decimal('24000.00'),
                'selling_price': Decimal('36000.00'),
                'image_url': 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
            },
            {
                'category_name': 'Barber',
                'description': 'Barber essentials and finishing tools.',
                'product_name': 'Precision Beard Trimmer',
                'sku': 'SKU-BR-001',
                'buying_price': Decimal('60000.00'),
                'selling_price': Decimal('89000.00'),
                'image_url': 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?auto=format&fit=crop&w=800&q=80',
            },
            {
                'category_name': 'Accessories',
                'description': 'Salon bags, combs, and accessories.',
                'product_name': 'Salon Utility Tote',
                'sku': 'SKU-AC-001',
                'buying_price': Decimal('32000.00'),
                'selling_price': Decimal('48000.00'),
                'image_url': 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
            },
            {
                'category_name': 'Beauty',
                'description': 'Creams, oils, and beauty finishing products.',
                'product_name': 'Glow Serum',
                'sku': 'SKU-BE-001',
                'buying_price': Decimal('38000.00'),
                'selling_price': Decimal('54000.00'),
                'image_url': 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80',
            },
            {
                'category_name': 'Makeup',
                'description': 'Color cosmetics for beauty and finishing looks.',
                'product_name': 'Velvet Lip Kit',
                'sku': 'SKU-MU-001',
                'buying_price': Decimal('22000.00'),
                'selling_price': Decimal('34000.00'),
                'image_url': 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?auto=format&fit=crop&w=800&q=80',
            },
            {
                'category_name': 'Nails',
                'description': 'Nail care, polish, and nail accessories.',
                'product_name': 'Gel Polish Duo',
                'sku': 'SKU-NA-001',
                'buying_price': Decimal('15000.00'),
                'selling_price': Decimal('23000.00'),
                'image_url': 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
            },
        ]

        created_categories = []
        for item in catalog:
            category, _ = Category.objects.get_or_create(
                category_name=item['category_name'],
                defaults={
                    'description': item['description'],
                    'image_url': item['image_url'],
                },
            )
            created_categories.append(category)
            Product.objects.get_or_create(
                sku=item['sku'],
                defaults={
                    'category': category,
                    'brand': brand,
                    'product_name': item['product_name'],
                    'description': f'{item["product_name"]} for {item["category_name"]} clients.',
                    'barcode': item['sku'],
                    'buying_price': item['buying_price'],
                    'selling_price': item['selling_price'],
                    'quantity_in_stock': 25,
                    'reorder_level': 5,
                    'image_url': item['image_url'],
                    'unit': 'each',
                    'status': 'Available',
                },
            )

        self.stdout.write(self.style.SUCCESS(f'Seeded {len(created_categories)} categories and products for the home screen.'))

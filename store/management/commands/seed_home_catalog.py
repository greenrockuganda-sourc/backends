from decimal import Decimal

from django.core.management.base import BaseCommand

from store.models import Brand, Category, Product


class Command(BaseCommand):
    help = 'Seed the homepage catalog with categories and products.'

    def handle(self, *args, **options):
        brand, _ = Brand.objects.get_or_create(
            brand_name='Glow',
            defaults={'description': 'Glow salon essentials and beauty must-haves.'},
        )

        catalog = {
            'Hair Care': [
                {
                    'name': 'Karseell Shampoo',
                    'description': 'Daily cleansing shampoo for healthy, hydrated hair.',
                    'sku': 'SKU-HAIR-CARE-SHAMPOO',
                    'buying_price': Decimal('25000'),
                    'selling_price': Decimal('45000'),
                    'quantity_in_stock': 18,
                    'image_url': 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=800&q=80',
                },
                {
                    'name': 'Redken Conditioner',
                    'description': 'Conditioner that softens and strengthens every strand.',
                    'sku': 'SKU-HAIR-CARE-CONDITIONER',
                    'buying_price': Decimal('32000'),
                    'selling_price': Decimal('75000'),
                    'quantity_in_stock': 12,
                    'image_url': 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80',
                },
            ],
            'Hair Tools': [
                {
                    'name': 'Wahl Clipper',
                    'description': 'Professional clipper for sharp fades and clean trims.',
                    'sku': 'SKU-HAIR-TOOLS-CLIPPER',
                    'buying_price': Decimal('110000'),
                    'selling_price': Decimal('210000'),
                    'quantity_in_stock': 7,
                    'image_url': 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=800&q=80',
                },
                {
                    'name': 'Salon Hair Dryer',
                    'description': 'Fast, strong airflow for smooth styling and drying.',
                    'sku': 'SKU-HAIR-TOOLS-DRYER',
                    'buying_price': Decimal('115000'),
                    'selling_price': Decimal('225000'),
                    'quantity_in_stock': 9,
                    'image_url': 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
                },
            ],
            'Styling': [
                {
                    'name': 'Glow Styling Gel',
                    'description': 'Strong hold gel for sleek, lasting finishes.',
                    'sku': 'SKU-STYLING-GEL',
                    'buying_price': Decimal('18000'),
                    'selling_price': Decimal('36000'),
                    'quantity_in_stock': 20,
                    'image_url': 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
                },
                {
                    'name': 'Luxury Hair Serum',
                    'description': 'Smooth, shine-enhancing serum for everyday styling.',
                    'sku': 'SKU-STYLING-SERUM',
                    'buying_price': Decimal('22000'),
                    'selling_price': Decimal('50000'),
                    'quantity_in_stock': 16,
                    'image_url': 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
                },
            ],
            'Barber': [
                {
                    'name': 'Precision Razor Set',
                    'description': 'Razor set built for close, easy barber finishing.',
                    'sku': 'SKU-BARBER-RAZOR',
                    'buying_price': Decimal('28000'),
                    'selling_price': Decimal('60000'),
                    'quantity_in_stock': 14,
                    'image_url': 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=800&q=80',
                },
                {
                    'name': 'Barber Trimmer Kit',
                    'description': 'All-in-one trimming kit for clean shaping and detailing.',
                    'sku': 'SKU-BARBER-TRIMMER',
                    'buying_price': Decimal('35000'),
                    'selling_price': Decimal('82000'),
                    'quantity_in_stock': 10,
                    'image_url': 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=800&q=80',
                },
            ],
            'Accessories': [
                {
                    'name': 'Salon Cap',
                    'description': 'Protective cap for clients and stylists alike.',
                    'sku': 'SKU-ACCESSORIES-CAP',
                    'buying_price': Decimal('9000'),
                    'selling_price': Decimal('18000'),
                    'quantity_in_stock': 30,
                    'image_url': 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
                },
                {
                    'name': 'Brush Set',
                    'description': 'Ergonomic brushes for healthy styling and finish.',
                    'sku': 'SKU-ACCESSORIES-BRUSH',
                    'buying_price': Decimal('12000'),
                    'selling_price': Decimal('24000'),
                    'quantity_in_stock': 28,
                    'image_url': 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
                },
            ],
            'Beauty': [
                {
                    'name': 'Glow Facial Kit',
                    'description': 'Hydrating facial care for a glowing, fresh finish.',
                    'sku': 'SKU-BEAUTY-FACIAL',
                    'buying_price': Decimal('25000'),
                    'selling_price': Decimal('56000'),
                    'quantity_in_stock': 13,
                    'image_url': 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
                },
                {
                    'name': 'Glow Body Lotion',
                    'description': 'Moisture-rich body lotion for soft, radiant skin.',
                    'sku': 'SKU-BEAUTY-LOTION',
                    'buying_price': Decimal('15000'),
                    'selling_price': Decimal('34000'),
                    'quantity_in_stock': 17,
                    'image_url': 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
                },
            ],
            'Makeup': [
                {
                    'name': 'Glow Foundation',
                    'description': 'Long-wear foundation for a polished, natural glow.',
                    'sku': 'SKU-MAKEUP-FOUNDATION',
                    'buying_price': Decimal('27000'),
                    'selling_price': Decimal('60000'),
                    'quantity_in_stock': 15,
                    'image_url': 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
                },
                {
                    'name': 'Glow Lip Tint',
                    'description': 'Smooth lip tint with nourishing, flattering color.',
                    'sku': 'SKU-MAKEUP-LIP-TINT',
                    'buying_price': Decimal('12000'),
                    'selling_price': Decimal('25000'),
                    'quantity_in_stock': 19,
                    'image_url': 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
                },
            ],
            'Nails': [
                {
                    'name': 'Gel Nail Kit',
                    'description': 'Fast setup kit for salon-quality manicures.',
                    'sku': 'SKU-NAILS-GEL-KIT',
                    'buying_price': Decimal('30000'),
                    'selling_price': Decimal('68000'),
                    'quantity_in_stock': 10,
                    'image_url': 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
                },
                {
                    'name': 'Nail Care Set',
                    'description': 'Hydrating nail care set for strong, healthy nails.',
                    'sku': 'SKU-NAILS-CARE-SET',
                    'buying_price': Decimal('16000'),
                    'selling_price': Decimal('33000'),
                    'quantity_in_stock': 21,
                    'image_url': 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
                },
            ],
        }

        for category_name, products in catalog.items():
            category, _ = Category.objects.get_or_create(
                category_name=category_name,
                defaults={'description': f'{category_name} essentials for salon and beauty care.'},
            )
            for item in products:
                Product.objects.get_or_create(
                    sku=item['sku'],
                    defaults={
                        'category': category,
                        'brand': brand,
                        'product_name': item['name'],
                        'description': item['description'],
                        'buying_price': item['buying_price'],
                        'selling_price': item['selling_price'],
                        'quantity_in_stock': item['quantity_in_stock'],
                        'status': 'Available',
                        'image_url': item['image_url'],
                    },
                )

        self.stdout.write(self.style.SUCCESS('Seeded homepage catalog categories and products.'))

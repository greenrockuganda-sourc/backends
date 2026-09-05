import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
import django
django.setup()
from decimal import Decimal
from store.models import Category, Brand, Product

def main():
    # Use existing category and brand ids (adjust if necessary)
    category = Category.objects.filter(pk=1).first()
    brand = Brand.objects.filter(pk=2).first()
    if not category or not brand:
        print('Missing category or brand (need category id=1 and brand id=2)')
        return

    prod, created = Product.objects.get_or_create(
        sku='AUTOCREATE-SKU-001',
        defaults={
            'category': category,
            'brand': brand,
            'product_name': 'Assistant Created Product',
            'description': 'Created by assistant script',
            'barcode': None,
            'buying_price': Decimal('30000.00'),
            'selling_price': Decimal('45000.00'),
            'quantity_in_stock': 5,
            'reorder_level': 0,
            'image_url': 'https://via.placeholder.com/600x400.png',
            'status': 'Available',
        }
    )
    if created:
        print(f'Created product id={prod.id} sku={prod.sku}')
    else:
        print(f'Product already exists id={prod.id} sku={prod.sku}')

if __name__ == '__main__':
    main()

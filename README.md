# Django Backend

This project contains a Django backend for a salon/products e-commerce domain with the following models:

- User
- Customer
- Category
- Brand
- Product
- ShoppingCart
- CartItem
- Order
- OrderItem
- Payment
- Delivery
- Receipt
- Notification
- Review

## Run locally

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Apply migrations:
   ```bash
   python manage.py migrate
   ```
3. Start the development server:
   ```bash
   python manage.py runserver
   ```

## Admin

Create a superuser with:

```bash
python manage.py createsuperuser
```

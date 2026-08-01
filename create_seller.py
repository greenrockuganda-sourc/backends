import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
import django
django.setup()
from django.contrib.auth import get_user_model

User = get_user_model()
email = 'joshuajessey@gmail.com'
u, created = User.objects.get_or_create(
    email=email,
    defaults={
        'first_name': 'Joshua',
        'last_name': 'Jessey',
        'role': 'Seller',
        'is_staff': True,
        'is_active': True,
    },
)
u.set_password('changemenow@1')
u.save()
print({'created': created, 'email': u.email, 'role': u.role, 'is_staff': u.is_staff, 'is_active': u.is_active})

import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
import django
django.setup()
from django.contrib.auth import get_user_model

User = get_user_model()
email = 'joshuajessey3@gmail.com'
password = 'changemenow@'

user = User.objects.filter(email=email).first()
if user:
    user.set_password(password)
    user.is_staff = True
    user.is_superuser = True
    user.role = 'Admin'
    user.save()
    print(f'Updated existing user: {user.email}')
else:
    user = User.objects.create_user(
        email=email,
        password=password,
        first_name='Jojo',
        last_name='User',
        role='Admin',
        is_staff=True,
        is_superuser=True,
    )
    print(f'Created new user: {user.email}')

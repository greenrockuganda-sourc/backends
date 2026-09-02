from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Brand, Category, Customer, Delivery, Notification, Order, Payment, Product, Receipt, Recipe, Review

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'email', 'phone_number', 'role', 'profile_image']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    phone_number = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    salon_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    location = serializers.CharField(write_only=True, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=['Customer', 'Seller'], required=False, default='Customer')

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'phone_number', 'password', 'salon_name', 'location', 'role']

    def validate(self, attrs):
        email = str(attrs.get('email') or '').strip().lower()
        phone_number = str(attrs.get('phone_number') or '').strip()
        role = attrs.get('role', 'Customer')

        if not email and not phone_number:
            raise serializers.ValidationError('Enter an email address, a phone number, or both.')
        if email and User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError({'email': 'An account with this email address already exists.'})
        if phone_number and User.objects.filter(phone_number=phone_number).exists():
            raise serializers.ValidationError({'phone_number': 'An account with this phone number already exists.'})
        if role == 'Customer':
            if not str(attrs.get('salon_name') or '').strip():
                raise serializers.ValidationError({'salon_name': 'Salon name is required.'})
            if not str(attrs.get('location') or '').strip():
                raise serializers.ValidationError({'location': 'Salon location is required.'})

        attrs['email'] = email or None
        attrs['phone_number'] = phone_number or None
        return attrs

    def create(self, validated_data):
        role = validated_data.pop('role', 'Customer')
        password = validated_data.pop('password')
        salon_name = validated_data.pop('salon_name', '')
        location = validated_data.pop('location', '')
        user = User.objects.create_user(
            email=validated_data['email'],
            password=password,
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            phone_number=validated_data.get('phone_number', ''),
            role=role,
            is_active=True,
        )
        if role == 'Customer':
            Customer.objects.create(
                user=user,
                salon_name=salon_name,
                owner_name=user.get_full_name(),
                address=location,
            )
        return user


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'phone_number', 'role', 'profile_image']
        read_only_fields = ['email', 'role']


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return attrs


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'category_name', 'description', 'image_url', 'created_at', 'updated_at']


class CategoryWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['category_name', 'description', 'image_url']


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ['id', 'brand_name', 'description', 'country', 'logo', 'created_at', 'updated_at']


class BrandWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ['brand_name', 'description', 'country', 'logo']


class RecipeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Recipe
        fields = ['id', 'title', 'description', 'prep_time', 'servings', 'ingredients', 'steps', 'created_at']
        read_only_fields = ['id', 'created_at']


class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    brand = BrandSerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(source='category', queryset=Category.objects.all(), write_only=True, required=False)
    brand_id = serializers.PrimaryKeyRelatedField(source='brand', queryset=Brand.objects.all(), write_only=True, required=False)
    image_urls = serializers.SerializerMethodField()
    sales_count = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'category', 'brand', 'category_id', 'brand_id', 'product_name', 'description', 'barcode', 'sku',
            'buying_price', 'selling_price', 'quantity_in_stock', 'reorder_level', 'sales_count', 'image_url', 'image_url_2', 'image_url_3', 'image_url_4', 'image_urls', 'weight', 'unit', 'status',
            'created_at', 'updated_at',
        ]

    def get_image_urls(self, obj):
        return [url for url in [obj.image_url, obj.image_url_2, obj.image_url_3, obj.image_url_4] if url]

    def get_sales_count(self, obj):
        return int(getattr(obj, 'sales_count', 0) or 0)


class ProductWriteSerializer(serializers.Serializer):
    category_id = serializers.IntegerField(required=False, allow_null=True)
    brand_id = serializers.IntegerField(required=False, allow_null=True)
    product_name = serializers.CharField(required=False, allow_blank=False)
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    barcode = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    sku = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    buying_price = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    selling_price = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    quantity_in_stock = serializers.IntegerField(required=False, min_value=0)
    reorder_level = serializers.IntegerField(required=False, min_value=0)
    image_url = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    image_url_2 = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    image_url_3 = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    image_url_4 = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    # Accept a list of image URLs uploaded directly to Cloudinary from the frontend.
    # Frontend can send `images` or `image_urls` as an array of strings; the view maps up to 4 entries.
    images = serializers.ListField(child=serializers.URLField(), required=False, allow_empty=True)
    image_urls = serializers.ListField(child=serializers.URLField(), required=False, allow_empty=True)
    weight = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    unit = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    status = serializers.ChoiceField(choices=Product.STATUS_CHOICES, required=False)


class CustomerSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    phone_number = serializers.CharField(source='user.phone_number', read_only=True)
    is_active = serializers.BooleanField(source='user.is_active', read_only=True)
    role = serializers.CharField(source='user.role', read_only=True)

    class Meta:
        model = Customer
        fields = ['id', 'email', 'first_name', 'last_name', 'phone_number', 'salon_name', 'owner_name', 'district', 'city', 'address', 'is_active', 'role', 'created_at', 'updated_at']


class CustomerWriteSerializer(serializers.Serializer):
    salon_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    owner_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    district = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    city = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    address = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    phone_number = serializers.CharField(required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False)


class CartAddSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1, default=1)


class CartUpdateSerializer(serializers.Serializer):
    cart_item_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)


class CartMergeSerializer(serializers.Serializer):
    session_id = serializers.CharField(required=False, allow_blank=True)


class OrderCreateSerializer(serializers.Serializer):
    delivery_address = serializers.CharField(required=False, allow_blank=True)
    phone_number = serializers.CharField(required=False, allow_blank=True)
    payment_method = serializers.ChoiceField(
        choices=[
            ('PAY_ON_DELIVERY', 'Pay on Delivery'),
            ('MTN_MOBILE_MONEY', 'MTN Mobile Money'),
            ('AIRTEL_MONEY', 'Airtel Money'),
            ('BANK_TRANSFER', 'Bank Transfer'),
        ],
        required=False,
        default='PAY_ON_DELIVERY',
    )
    notes = serializers.CharField(required=False, allow_blank=True)


class OrderStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[
        ('Pending', 'Pending'),
        ('Confirmed', 'Confirmed'),
        ('Processing', 'Processing'),
        ('Packed', 'Packed'),
        ('Out for Delivery', 'Out for Delivery'),
        ('Delivered', 'Delivered'),
        ('Cancelled', 'Cancelled'),
    ])


class PaymentUpdateSerializer(serializers.Serializer):
    payment_status = serializers.ChoiceField(choices=[('Pending', 'Pending'), ('Paid', 'Paid'), ('Failed', 'Failed')])


class PaymentWriteSerializer(serializers.Serializer):
    payment_status = serializers.ChoiceField(choices=[('Pending', 'Pending'), ('Paid', 'Paid'), ('Failed', 'Failed')], required=False)
    payment_method = serializers.ChoiceField(choices=[
        ('MTN MoMo', 'MTN MoMo'),
        ('Airtel Money', 'Airtel Money'),
        ('Cash', 'Cash'),
        ('Bank Transfer', 'Bank Transfer'),
        ('Card', 'Card'),
    ], required=False)


class DeliveryUpdateSerializer(serializers.Serializer):
    delivery_status = serializers.ChoiceField(choices=[
        ('Preparing', 'Preparing'),
        ('Packed', 'Packed'),
        ('Out for Delivery', 'Out for Delivery'),
        ('Delivered', 'Delivered'),
    ], required=False)
    delivery_person = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    delivery_phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    delivery_notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class NotificationReadSerializer(serializers.Serializer):
    is_read = serializers.BooleanField(required=False)

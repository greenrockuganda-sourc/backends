import csv
import io
import os
from decimal import Decimal

import cloudinary
import cloudinary.uploader
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import F, Q, Sum
from django.http import FileResponse, HttpResponse
from django.template.loader import render_to_string
from django.conf import settings
from django.core.mail import EmailMessage
import tempfile
from reportlab.pdfgen import canvas
from io import BytesIO
from django.shortcuts import render
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import status
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from .models import Brand, CartItem, Category, Customer, Delivery, Notification, Order, OrderItem, OrderStatusHistory, Payment, Product, Recipe, Receipt, Review, ShoppingCart
from .serializers import (
    BrandWriteSerializer,
    CartAddSerializer,
    CartMergeSerializer,
    CartUpdateSerializer,
    CategoryWriteSerializer,
    CustomerWriteSerializer,
    DeliveryUpdateSerializer,
    ForgotPasswordSerializer,
    NotificationReadSerializer,
    OrderCreateSerializer,
    OrderStatusSerializer,
    PaymentUpdateSerializer,
    PaymentWriteSerializer,
    ProductSerializer,
    ProductWriteSerializer,
    ProfileSerializer,
    RecipeSerializer,
    RegisterSerializer,
    ResetPasswordSerializer,
    UserSerializer,
)

User = get_user_model()

cloudinary.config(
    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME', 'h78tlu47'),
    api_key=os.getenv('CLOUDINARY_API_KEY', '897413134117273'),
    api_secret=os.getenv('CLOUDINARY_API_SECRET', ''),
    secure=True,
)


def upload_image_to_cloudinary(uploaded_file):
    if not uploaded_file:
        return None

    try:
        result = cloudinary.uploader.upload(
            uploaded_file,
            folder='growsalon/products',
            resource_type='image',
            quality='auto',
            fetch_format='auto',
        )
        return result.get('secure_url')
    except Exception:
        return None


def _add_order_status_history(order, status, title, detail):
    return OrderStatusHistory.objects.create(order=order, status=status, title=title, detail=detail)


class IsActiveUser(BasePermission):
    def has_permission(self, request, view):
        if not IsAuthenticated().has_permission(request, view):
            return False
        return bool(request.user and request.user.is_active)


class IsAdminUser(BasePermission):
    def has_permission(self, request, view):
        if not IsActiveUser().has_permission(request, view):
            return False
        role = str(getattr(request.user, 'role', '') or '').strip().lower()
        return role in {'admin', 'seller'}


class RegisterAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(
                {'message': 'Account created successfully.', 'user': UserSerializer(user).data},
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        identifier = (
            request.data.get('email')
            or request.data.get('phone_number')
            or request.data.get('email_or_phone')
            or ''
        ).strip()
        password = request.data.get('password')

        if not identifier or not password:
            return Response({'detail': 'Email or phone number and password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(request, username=identifier, password=password)
        if not user:
            return Response({'detail': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': UserSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )


class LogoutAPIView(APIView):
    permission_classes = [IsActiveUser]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass
        return Response({'message': 'Logged out successfully.'}, status=status.HTTP_200_OK)


class RefreshAPIView(TokenRefreshView):
    permission_classes = [AllowAny]


class ForgotPasswordAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email']
        user = User.objects.filter(email=email).first()
        if not user:
            return Response({'message': 'If that email exists, a reset link has been prepared.'}, status=status.HTTP_200_OK)

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        return Response({'message': 'Reset instructions prepared.', 'uid': uid, 'token': token}, status=status.HTTP_200_OK)


class ResetPasswordAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        uid = serializer.validated_data['uid']
        token = serializer.validated_data['token']
        new_password = serializer.validated_data['new_password']

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({'detail': 'Invalid reset link.'}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({'detail': 'Invalid reset link.'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        return Response({'message': 'Password reset successful.'}, status=status.HTTP_200_OK)


class BannerListAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        banners = []
        for product in Product.objects.select_related('category').order_by('-created_at')[:3]:
            banners.append({
                'id': product.id,
                'title': 'Everything your salon needs.',
                'subtitle': 'Delivered',
                'highlight': 'Delivered',
                'description': product.description or f'{product.product_name} for every salon service.',
                'image_url': product.image_url or 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
                'cta_label': 'Shop Now',
            })
        if not banners:
            banners = [{
                'id': 1,
                'title': 'Everything your salon needs.',
                'subtitle': 'Delivered',
                'highlight': 'Delivered',
                'description': 'Premium care, styling, and barber essentials.',
                'image_url': 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
                'cta_label': 'Shop Now',
            }]
        return Response(banners, status=status.HTTP_200_OK)


class BestSellerProductAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        queryset = Product.objects.select_related('category', 'brand').order_by('-selling_price')[:8]
        if queryset.exists():
            payload = ProductSerializer(queryset, many=True).data
        else:
            payload = [
                {
                    'id': 1,
                    'product_name': 'Karseell Shampoo',
                    'selling_price': 45000,
                    'image_url': 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=800&q=80',
                    'status': 'Available',
                    'category': {'category_name': 'Hair Care'},
                },
                {
                    'id': 2,
                    'product_name': 'Wahl Clipper',
                    'selling_price': 210000,
                    'image_url': 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=800&q=80',
                    'status': 'Available',
                    'category': {'category_name': 'Hair Tools'},
                },
                {
                    'id': 3,
                    'product_name': 'Redken Conditioner',
                    'selling_price': 75000,
                    'image_url': 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80',
                    'status': 'Available',
                    'category': {'category_name': 'Hair Care'},
                },
            ]
        return Response({'results': payload}, status=status.HTTP_200_OK)


class HomeProfileAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        if request.user.is_authenticated and getattr(request.user, 'is_active', False):
            return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)
        return Response({
            'first_name': 'Guest',
            'last_name': '',
            'email': 'guest@growsalon.com',
            'phone_number': '',
            'role': 'Customer',
            'profile_image': '',
        }, status=status.HTTP_200_OK)


class ProfileAPIView(APIView):
    permission_classes = [IsActiveUser]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        serializer = ProfileSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DashboardAPIView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        today = timezone.now().date()
        start_of_week = today - timezone.timedelta(days=today.weekday())
        start_of_month = today.replace(day=1)

        total_products = Product.objects.count()
        total_categories = Category.objects.count()
        total_brands = Brand.objects.count()
        total_customers = Customer.objects.count()
        total_orders = Order.objects.count()
        orders_today = Order.objects.filter(order_date__date=today).count()
        pending_orders = Order.objects.filter(order_status='Pending').count()
        processing_orders = Order.objects.filter(order_status='Processing').count()
        out_for_delivery = Order.objects.filter(order_status='Out for Delivery').count()
        delivered_orders = Order.objects.filter(order_status='Delivered').count()
        cancelled_orders = Order.objects.filter(order_status='Cancelled').count()
        low_stock_products = Product.objects.filter(quantity_in_stock__lte=F('reorder_level')).count()
        out_of_stock_products = Product.objects.filter(quantity_in_stock__lte=0).count()

        revenue_today = Order.objects.filter(order_date__date=today).aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
        revenue_week = Order.objects.filter(order_date__date__gte=start_of_week).aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
        revenue_month = Order.objects.filter(order_date__date__gte=start_of_month).aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')

        daily_sales = []
        for offset in range(6, -1, -1):
            day = today - timezone.timedelta(days=offset)
            total = Order.objects.filter(order_date__date=day).aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
            daily_sales.append({'date': day.isoformat(), 'revenue': float(total)})

        monthly_sales = []
        for offset in range(5, -1, -1):
            month = timezone.now().replace(day=1) - timezone.timedelta(days=offset * 30)
            total = Order.objects.filter(order_date__year=month.year, order_date__month=month.month).aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
            monthly_sales.append({'date': month.strftime('%Y-%m'), 'revenue': float(total)})

        order_breakdown = []
        for status_name in ['Pending', 'Confirmed', 'Processing', 'Packed', 'Out for Delivery', 'Delivered', 'Cancelled']:
            order_breakdown.append({'status': status_name, 'count': Order.objects.filter(order_status=status_name).count()})

        best_selling_products = []
        for item in OrderItem.objects.values('product_name').annotate(total_quantity=Sum('quantity')).order_by('-total_quantity')[:5]:
            best_selling_products.append({'product_name': item['product_name'], 'total_quantity': item['total_quantity']})

        top_customers = []
        for customer in Customer.objects.select_related('user').annotate(total_spend=Sum('orders__total_amount')).order_by('-total_spend')[:5]:
            top_customers.append({
                'customer': customer.user.get_full_name() or customer.user.email,
                'salon_name': customer.salon_name or '',
                'total_spend': float(customer.total_spend or Decimal('0.00')),
            })

        recent_orders = []
        for order in Order.objects.select_related('customer__user').order_by('-created_at')[:5]:
            recent_orders.append({
                'id': order.id,
                'order_number': order.order_number,
                'customer': order.customer.user.get_full_name() or order.customer.user.email,
                'total_amount': float(order.total_amount),
                'order_status': order.order_status,
                'created_at': order.created_at.isoformat(),
            })

        recent_customers = []
        for customer in Customer.objects.select_related('user').order_by('-created_at')[:5]:
            recent_customers.append({
                'id': customer.id,
                'name': customer.user.get_full_name() or customer.user.email,
                'salon_name': customer.salon_name or '',
                'email': customer.user.email,
                'phone': customer.user.phone_number or '',
            })

        recent_payments = []
        for payment in Payment.objects.select_related('order').order_by('-created_at')[:5]:
            recent_payments.append({
                'id': payment.id,
                'order_number': payment.order.order_number,
                'amount': float(payment.amount),
                'payment_method': payment.payment_method,
                'payment_status': payment.payment_status,
                'payment_date': payment.payment_date.isoformat() if payment.payment_date else None,
            })

        return Response({
            'summary': {
                'total_products': total_products,
                'total_categories': total_categories,
                'total_brands': total_brands,
                'total_customers': total_customers,
                'total_orders': total_orders,
                'orders_today': orders_today,
                'pending_orders': pending_orders,
                'processing_orders': processing_orders,
                'out_for_delivery': out_for_delivery,
                'delivered_orders': delivered_orders,
                'cancelled_orders': cancelled_orders,
                'low_stock_products': low_stock_products,
                'out_of_stock_products': out_of_stock_products,
                'revenue_today': float(revenue_today),
                'revenue_this_week': float(revenue_week),
                'revenue_this_month': float(revenue_month),
            },
            'charts': {
                'daily_sales': daily_sales,
                'monthly_sales': monthly_sales,
                'orders_by_status': order_breakdown,
                'best_selling_products': best_selling_products,
                'top_customers': top_customers,
            },
            'recent_activity': {
                'recent_orders': recent_orders,
                'recent_customers': recent_customers,
                'recent_payments': recent_payments,
            },
        }, status=status.HTTP_200_OK)


class ProductListCreateAPIView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        queryset = Product.objects.select_related('category', 'brand').all()
        search = request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(product_name__icontains=search)
                | Q(sku__icontains=search)
                | Q(barcode__icontains=search)
                | Q(description__icontains=search)
            )

        category_id = request.query_params.get('category_id')
        if category_id:
            queryset = queryset.filter(category_id=category_id)

        brand_id = request.query_params.get('brand_id')
        if brand_id:
            queryset = queryset.filter(brand_id=brand_id)

        min_price = request.query_params.get('min_price')
        if min_price:
            queryset = queryset.filter(selling_price__gte=min_price)

        max_price = request.query_params.get('max_price')
        if max_price:
            queryset = queryset.filter(selling_price__lte=max_price)

        sort_by = (request.query_params.get('sort_by') or 'created_at').lower()
        order = (request.query_params.get('order') or 'desc').lower()
        if sort_by == 'price':
            sort_field = 'selling_price'
        elif sort_by == 'stock':
            sort_field = 'quantity_in_stock'
        elif sort_by == 'name':
            sort_field = 'product_name'
        else:
            sort_field = 'created_at'

        queryset = queryset.order_by(('-' if order == 'desc' else '') + sort_field)

        page = int(request.query_params.get('page', 1) or 1)
        page_size = int(request.query_params.get('page_size', 20) or 20)
        page_size = max(1, min(page_size, 100))
        start = (page - 1) * page_size
        end = start + page_size
        data = ProductSerializer(queryset[start:end], many=True).data
        return Response({'count': queryset.count(), 'page': page, 'page_size': page_size, 'results': data}, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = ProductWriteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated = serializer.validated_data
        category_id = validated.get('category_id')
        brand_id = validated.get('brand_id')
        category = Category.objects.filter(pk=category_id).first() if category_id else None
        brand = Brand.objects.filter(pk=brand_id).first() if brand_id else None
        if not category or not brand:
            return Response({'detail': 'Category and brand are required.'}, status=status.HTTP_400_BAD_REQUEST)

        image_url = validated.get('image_url') or ''
        if 'image' in request.FILES:
            uploaded = request.FILES['image']
            uploaded_url = upload_image_to_cloudinary(uploaded)
            if uploaded_url:
                image_url = uploaded_url
            else:
                path = default_storage.save(f'products/{uploaded.name}', uploaded)
                image_url = request.build_absolute_uri(default_storage.url(path))

        product = Product.objects.create(
            category=category,
            brand=brand,
            product_name=validated.get('product_name') or 'New Product',
            description=validated.get('description') or '',
            barcode=validated.get('barcode') or '',
            sku=validated.get('sku') or '',
            buying_price=validated.get('buying_price') or Decimal('0.00'),
            selling_price=validated.get('selling_price') or Decimal('0.00'),
            quantity_in_stock=validated.get('quantity_in_stock') or 0,
            reorder_level=validated.get('reorder_level') or 0,
            image_url=image_url,
            weight=validated.get('weight'),
            unit=validated.get('unit') or '',
            status=validated.get('status') or ('Out of Stock' if (validated.get('quantity_in_stock') or 0) <= 0 else 'Available'),
        )
        return Response(ProductSerializer(product).data, status=status.HTTP_201_CREATED)


class RecipeListCreateAPIView(APIView):
    permission_classes = [IsActiveUser]

    def get(self, request):
        queryset = Recipe.objects.filter(user=request.user).order_by('-created_at')
        serializer = RecipeSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = RecipeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        recipe = serializer.save(user=request.user)
        return Response(RecipeSerializer(recipe).data, status=status.HTTP_201_CREATED)


class RecipeDetailAPIView(APIView):
    permission_classes = [IsActiveUser]

    def get(self, request, recipe_id):
        recipe = Recipe.objects.filter(pk=recipe_id, user=request.user).first()
        if not recipe:
            return Response({'detail': 'Recipe not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(RecipeSerializer(recipe).data, status=status.HTTP_200_OK)

    def put(self, request, recipe_id):
        recipe = Recipe.objects.filter(pk=recipe_id, user=request.user).first()
        if not recipe:
            return Response({'detail': 'Recipe not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = RecipeSerializer(recipe, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, recipe_id):
        recipe = Recipe.objects.filter(pk=recipe_id, user=request.user).first()
        if not recipe:
            return Response({'detail': 'Recipe not found.'}, status=status.HTTP_404_NOT_FOUND)
        recipe.delete()
        return Response({'message': 'Recipe deleted successfully.'}, status=status.HTTP_204_NO_CONTENT)


class ProductDetailAPIView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, product_id):
        product = Product.objects.select_related('category', 'brand').filter(pk=product_id).first()
        if not product:
            return Response({'detail': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ProductSerializer(product).data, status=status.HTTP_200_OK)

    def put(self, request, product_id):
        product = Product.objects.filter(pk=product_id).first()
        if not product:
            return Response({'detail': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ProductWriteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        validated = serializer.validated_data
        if validated.get('category_id'):
            product.category = Category.objects.get(pk=validated['category_id'])
        if validated.get('brand_id'):
            product.brand = Brand.objects.get(pk=validated['brand_id'])
        if validated.get('product_name') is not None:
            product.product_name = validated['product_name']
        if validated.get('description') is not None:
            product.description = validated['description']
        if validated.get('barcode') is not None:
            product.barcode = validated['barcode']
        if validated.get('sku') is not None:
            product.sku = validated['sku']
        if validated.get('buying_price') is not None:
            product.buying_price = validated['buying_price']
        if validated.get('selling_price') is not None:
            product.selling_price = validated['selling_price']
        if validated.get('quantity_in_stock') is not None:
            product.quantity_in_stock = validated['quantity_in_stock']
        if validated.get('reorder_level') is not None:
            product.reorder_level = validated['reorder_level']
        if validated.get('image_url') is not None:
            product.image_url = validated['image_url']
        if 'image' in request.FILES:
            uploaded = request.FILES['image']
            uploaded_url = upload_image_to_cloudinary(uploaded)
            if uploaded_url:
                product.image_url = uploaded_url
        if validated.get('weight') is not None:
            product.weight = validated['weight']
        if validated.get('unit') is not None:
            product.unit = validated['unit']
        if validated.get('status') is not None:
            product.status = validated['status']
        if product.quantity_in_stock <= 0:
            product.status = 'Out of Stock'
        elif product.status == 'Out of Stock':
            product.status = 'Available'
        product.save()
        return Response(ProductSerializer(product).data, status=status.HTTP_200_OK)

    def patch(self, request, product_id):
        return self.put(request, product_id)

    def delete(self, request, product_id):
        product = Product.objects.filter(pk=product_id).first()
        if not product:
            return Response({'detail': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)
        product.delete()
        return Response({'message': 'Product deleted.'}, status=status.HTTP_200_OK)


class ProductSearchAPIView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        return ProductListCreateAPIView().get(request)


class CategoryListCreateAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        categories = Category.objects.all().order_by('category_name')
        return Response(CategoryWriteSerializer(categories, many=True).data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = CategoryWriteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        category = serializer.save()
        return Response({'id': category.id, 'category_name': category.category_name, 'description': category.description, 'image_url': category.image_url}, status=status.HTTP_201_CREATED)


class CategoryDetailAPIView(APIView):
    permission_classes = [IsAdminUser]

    def put(self, request, category_id):
        category = Category.objects.filter(pk=category_id).first()
        if not category:
            return Response({'detail': 'Category not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = CategoryWriteSerializer(category, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response({'id': category.id, 'category_name': category.category_name, 'description': category.description, 'image_url': category.image_url}, status=status.HTTP_200_OK)

    def delete(self, request, category_id):
        category = Category.objects.filter(pk=category_id).first()
        if not category:
            return Response({'detail': 'Category not found.'}, status=status.HTTP_404_NOT_FOUND)
        category.delete()
        return Response({'message': 'Category deleted.'}, status=status.HTTP_200_OK)


class BrandListCreateAPIView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        brands = Brand.objects.all().order_by('brand_name')
        return Response(BrandWriteSerializer(brands, many=True).data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = BrandWriteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        brand = serializer.save()
        return Response({'id': brand.id, 'brand_name': brand.brand_name, 'description': brand.description, 'country': brand.country, 'logo': brand.logo}, status=status.HTTP_201_CREATED)


class BrandDetailAPIView(APIView):
    permission_classes = [IsAdminUser]

    def put(self, request, brand_id):
        brand = Brand.objects.filter(pk=brand_id).first()
        if not brand:
            return Response({'detail': 'Brand not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = BrandWriteSerializer(brand, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response({'id': brand.id, 'brand_name': brand.brand_name, 'description': brand.description, 'country': brand.country, 'logo': brand.logo}, status=status.HTTP_200_OK)

    def delete(self, request, brand_id):
        brand = Brand.objects.filter(pk=brand_id).first()
        if not brand:
            return Response({'detail': 'Brand not found.'}, status=status.HTTP_404_NOT_FOUND)
        brand.delete()
        return Response({'message': 'Brand deleted.'}, status=status.HTTP_200_OK)


class InventoryAdminAPIView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        inventory = Product.objects.select_related('category', 'brand').all().order_by('quantity_in_stock')
        data = []
        for product in inventory:
            data.append({
                'id': product.id,
                'product': product.product_name,
                'current_stock': product.quantity_in_stock,
                'reorder_level': product.reorder_level,
                'stock_status': 'Out of Stock' if product.quantity_in_stock <= 0 else ('Low Stock' if product.quantity_in_stock <= product.reorder_level else 'In Stock'),
                'last_updated': product.updated_at.isoformat(),
            })
        return Response(data, status=status.HTTP_200_OK)

    def patch(self, request, product_id):
        product = Product.objects.filter(pk=product_id).first()
        if not product:
            return Response({'detail': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)
        change = int(request.data.get('change', 0))
        if change == 0:
            return Response({'detail': 'Provide a stock change value.'}, status=status.HTTP_400_BAD_REQUEST)
        new_stock = product.quantity_in_stock + change
        product.quantity_in_stock = max(0, new_stock)
        product.status = 'Out of Stock' if product.quantity_in_stock <= 0 else ('Available' if product.quantity_in_stock > product.reorder_level else 'Available')
        product.save(update_fields=['quantity_in_stock', 'status'])
        return Response({'id': product.id, 'current_stock': product.quantity_in_stock, 'stock_status': 'Out of Stock' if product.quantity_in_stock <= 0 else ('Low Stock' if product.quantity_in_stock <= product.reorder_level else 'In Stock')}, status=status.HTTP_200_OK)


class CustomerAdminListAPIView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        queryset = Customer.objects.select_related('user').all()
        search = request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
                | Q(salon_name__icontains=search)
                | Q(user__phone_number__icontains=search)
                | Q(user__email__icontains=search)
            )
        customers = queryset.order_by('-created_at')
        data = []
        for customer in customers:
            data.append({
                'id': customer.id,
                'customer_name': customer.user.get_full_name() or customer.user.email,
                'salon_name': customer.salon_name or '',
                'email': customer.user.email,
                'phone': customer.user.phone_number or '',
                'address': customer.address or '',
                'number_of_orders': customer.orders.count(),
                'total_purchases': float(customer.orders.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')),
                'is_active': customer.user.is_active,
            })
        return Response(data, status=status.HTTP_200_OK)


class CustomerAdminDetailAPIView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, customer_id):
        customer = Customer.objects.select_related('user').filter(pk=customer_id).first()
        if not customer:
            return Response({'detail': 'Customer not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            'id': customer.id,
            'customer_name': customer.user.get_full_name() or customer.user.email,
            'salon_name': customer.salon_name or '',
            'email': customer.user.email,
            'phone': customer.user.phone_number or '',
            'address': customer.address or '',
            'number_of_orders': customer.orders.count(),
            'total_purchases': float(customer.orders.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')),
            'is_active': customer.user.is_active,
            'order_history': [
                {'id': order.id, 'order_number': order.order_number, 'total_amount': float(order.total_amount), 'order_status': order.order_status}
                for order in customer.orders.order_by('-created_at')[:10]
            ],
        }, status=status.HTTP_200_OK)

    def patch(self, request, customer_id):
        customer = Customer.objects.select_related('user').filter(pk=customer_id).first()
        if not customer:
            return Response({'detail': 'Customer not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = CustomerWriteSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        validated = serializer.validated_data
        if validated.get('salon_name') is not None:
            customer.salon_name = validated['salon_name']
        if validated.get('owner_name') is not None:
            customer.owner_name = validated['owner_name']
        if validated.get('district') is not None:
            customer.district = validated['district']
        if validated.get('city') is not None:
            customer.city = validated['city']
        if validated.get('address') is not None:
            customer.address = validated['address']
        if validated.get('first_name') is not None:
            customer.user.first_name = validated['first_name']
        if validated.get('last_name') is not None:
            customer.user.last_name = validated['last_name']
        if validated.get('phone_number') is not None:
            customer.user.phone_number = validated['phone_number']
        if validated.get('is_active') is not None:
            customer.user.is_active = validated['is_active']
        customer.user.save(update_fields=['first_name', 'last_name', 'phone_number', 'is_active'])
        customer.save()
        return Response({'message': 'Customer updated.'}, status=status.HTTP_200_OK)


class AdminOrderDetailAPIView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, order_id):
        order = Order.objects.select_related('customer__user').filter(pk=order_id).first()
        if not order:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            'id': order.id,
            'order_number': order.order_number,
            'customer': order.customer.user.get_full_name() or order.customer.user.email,
            'total_amount': float(order.total_amount),
            'payment_method': order.payment_method,
            'payment_status': order.payment_status,
            'order_status': order.order_status,
            'delivery_address': order.delivery_address,
            'phone_number': order.phone_number,
            'notes': order.notes,
            'items': [
                {'product_name': item.product_name, 'quantity': item.quantity, 'unit_price': float(item.unit_price), 'subtotal': float(item.subtotal)}
                for item in order.items.all()
            ],
        }, status=status.HTTP_200_OK)


class AdminCancelOrderAPIView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, order_id):
        order = Order.objects.filter(pk=order_id).first()
        if not order:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)
        if order.order_status == 'Cancelled':
            return Response({'detail': 'Order already cancelled.'}, status=status.HTTP_400_BAD_REQUEST)

        order.order_status = 'Cancelled'
        order.save(update_fields=['order_status'])
        _add_order_status_history(order, 'Cancelled', 'Order cancelled', 'Your order has been cancelled by the seller due to stock or processing issues.')
        Notification.objects.create(
            user=order.customer.user,
            title='Order cancelled',
            message=f'Your order {order.order_number} was cancelled by the seller. We have refunded your stock reservations.',
            notification_type='order',
        )
        for item in order.items.all():
            item.product.quantity_in_stock += item.quantity
            if item.product.quantity_in_stock > 0:
                item.product.status = 'Available'
            item.product.save(update_fields=['quantity_in_stock', 'status'])
        return Response({'message': 'Order cancelled.'}, status=status.HTTP_200_OK)


class AdminPaymentListAPIView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        payments = Payment.objects.select_related('order', 'order__customer__user').all().order_by('-created_at')
        data = [{
            'id': payment.id,
            'customer': payment.order.customer.user.get_full_name() or payment.order.customer.user.email,
            'order_number': payment.order.order_number,
            'amount': float(payment.amount),
            'payment_method': payment.payment_method,
            'payment_status': payment.payment_status,
            'payment_date': payment.payment_date.isoformat() if payment.payment_date else None,
        } for payment in payments]
        return Response(data, status=status.HTTP_200_OK)


class AdminPaymentDetailAPIView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, payment_id):
        payment = Payment.objects.filter(pk=payment_id).first()
        if not payment:
            return Response({'detail': 'Payment not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = PaymentWriteSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        validated = serializer.validated_data
        if validated.get('payment_status') is not None:
            payment.payment_status = validated['payment_status']
        if validated.get('payment_method') is not None:
            payment.payment_method = validated['payment_method']
        payment.save()
        return Response({'message': 'Payment updated.'}, status=status.HTTP_200_OK)


class AdminDeliveryListAPIView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        deliveries = Delivery.objects.select_related('order', 'order__customer__user').all().order_by('-created_at')
        data = [{
            'id': delivery.id,
            'order_number': delivery.order.order_number,
            'customer': delivery.order.customer.user.get_full_name() or delivery.order.customer.user.email,
            'delivery_address': delivery.order.delivery_address,
            'delivery_status': delivery.delivery_status,
            'delivery_date': delivery.delivery_date.isoformat() if delivery.delivery_date else None,
        } for delivery in deliveries]
        return Response(data, status=status.HTTP_200_OK)


class AdminDeliveryDetailAPIView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, delivery_id):
        delivery = Delivery.objects.filter(pk=delivery_id).first()
        if not delivery:
            return Response({'detail': 'Delivery not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = DeliveryUpdateSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        validated = serializer.validated_data
        if validated.get('delivery_status') is not None:
            delivery.delivery_status = validated['delivery_status']
        if validated.get('delivery_person') is not None:
            delivery.delivery_person = validated['delivery_person']
        if validated.get('delivery_phone') is not None:
            delivery.delivery_phone = validated['delivery_phone']
        if validated.get('delivery_notes') is not None:
            delivery.delivery_notes = validated['delivery_notes']
        if delivery.delivery_status == 'Delivered' and not delivery.delivery_date:
            delivery.delivery_date = timezone.now()
        delivery.save()
        return Response({'message': 'Delivery updated.'}, status=status.HTTP_200_OK)


class AdminReceiptListAPIView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        receipts = Receipt.objects.select_related('order', 'order__customer__user').all().order_by('-created_at')
        data = [{
            'id': receipt.id,
            'receipt_number': receipt.receipt_number,
            'customer': receipt.order.customer.user.get_full_name() or receipt.order.customer.user.email,
            'order_number': receipt.order.order_number,
            'amount': float(receipt.total_amount),
            'date': receipt.receipt_date.isoformat(),
        } for receipt in receipts]
        return Response(data, status=status.HTTP_200_OK)


class AdminReviewListAPIView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        reviews = Review.objects.select_related('customer__user', 'product').all().order_by('-created_at')
        data = [{
            'id': review.id,
            'customer': review.customer.user.get_full_name() or review.customer.user.email,
            'product': review.product.product_name,
            'rating': review.rating,
            'comment': review.comment,
            'date': review.created_at.isoformat(),
        } for review in reviews]
        return Response(data, status=status.HTTP_200_OK)


class AdminReviewDetailAPIView(APIView):
    permission_classes = [IsAdminUser]

    def delete(self, request, review_id):
        review = Review.objects.filter(pk=review_id).first()
        if not review:
            return Response({'detail': 'Review not found.'}, status=status.HTTP_404_NOT_FOUND)
        review.delete()
        return Response({'message': 'Review deleted.'}, status=status.HTTP_200_OK)


class AdminNotificationListAPIView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        notifications = Notification.objects.filter(user=request.user).order_by('-created_at')
        data = [{
            'id': notification.id,
            'title': notification.title,
            'message': notification.message,
            'notification_type': notification.notification_type,
            'is_read': notification.is_read,
            'created_at': notification.created_at.isoformat(),
        } for notification in notifications]
        return Response(data, status=status.HTTP_200_OK)


class AdminNotificationDetailAPIView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, notification_id):
        notification = Notification.objects.filter(pk=notification_id, user=request.user).first()
        if not notification:
            return Response({'detail': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = NotificationReadSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        notification.is_read = serializer.validated_data.get('is_read', True)
        notification.save(update_fields=['is_read'])
        return Response({'message': 'Notification updated.'}, status=status.HTTP_200_OK)

    def delete(self, request, notification_id):
        notification = Notification.objects.filter(pk=notification_id, user=request.user).first()
        if not notification:
            return Response({'detail': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)
        notification.delete()
        return Response({'message': 'Notification deleted.'}, status=status.HTTP_200_OK)


class ReportAPIView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, report_type):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        queryset = Order.objects.select_related('customer__user').all()
        if start_date:
            queryset = queryset.filter(order_date__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(order_date__date__lte=end_date)

        if report_type == 'sales':
            payload = {
                'total_orders': queryset.count(),
                'total_revenue': float(queryset.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')),
                'orders_by_status': [{status_name: queryset.filter(order_status=status_name).count()} for status_name in ['Pending', 'Confirmed', 'Processing', 'Packed', 'Out for Delivery', 'Delivered', 'Cancelled']],
            }
        elif report_type == 'orders':
            payload = {'orders': [{'id': order.id, 'order_number': order.order_number, 'status': order.order_status, 'amount': float(order.total_amount)} for order in queryset.order_by('-created_at')[:20]]}
        elif report_type == 'products':
            payload = {'products': [{'product_name': product.product_name, 'stock': product.quantity_in_stock, 'status': product.status} for product in Product.objects.order_by('-quantity_in_stock')[:20]]}
        elif report_type == 'customers':
            payload = {'customers': [{'customer_name': customer.user.get_full_name() or customer.user.email, 'orders': customer.orders.count(), 'total_spend': float(customer.orders.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00'))} for customer in Customer.objects.select_related('user').all()[:20]]}
        else:
            payload = {'detail': 'Unsupported report type.'}

        if request.query_params.get('format') == 'csv':
            output = io.StringIO()
            writer = csv.writer(output)
            if report_type == 'sales':
                writer.writerow(['metric', 'value'])
                for key, value in payload.items():
                    writer.writerow([key, value])
            elif report_type == 'orders':
                writer.writerow(['id', 'order_number', 'status', 'amount'])
                for item in payload['orders']:
                    writer.writerow([item['id'], item['order_number'], item['status'], item['amount']])
            elif report_type == 'products':
                writer.writerow(['product_name', 'stock', 'status'])
                for item in payload['products']:
                    writer.writerow([item['product_name'], item['stock'], item['status']])
            else:
                writer.writerow(['customer_name', 'orders', 'total_spend'])
                for item in payload['customers']:
                    writer.writerow([item['customer_name'], item['orders'], item['total_spend']])
            response = HttpResponse(output.getvalue(), content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="{report_type}_report.csv"'
            return response
        return Response(payload, status=status.HTTP_200_OK)


class GlobalSearchAPIView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        payload = {
            'products': ProductSerializer(Product.objects.filter(Q(product_name__icontains=query) | Q(sku__icontains=query) | Q(barcode__icontains=query)).select_related('category', 'brand')[:10], many=True).data if query else [],
            'orders': [{'id': order.id, 'order_number': order.order_number, 'order_status': order.order_status} for order in Order.objects.filter(order_number__icontains=query).order_by('-created_at')[:10]] if query else [],
            'customers': [{'id': customer.id, 'customer_name': customer.user.get_full_name() or customer.user.email, 'salon_name': customer.salon_name or ''} for customer in Customer.objects.select_related('user').filter(Q(user__first_name__icontains=query) | Q(user__last_name__icontains=query) | Q(salon_name__icontains=query)).order_by('-created_at')[:10]] if query else [],
            'categories': [{'id': category.id, 'category_name': category.category_name} for category in Category.objects.filter(category_name__icontains=query).order_by('category_name')[:10]] if query else [],
            'brands': [{'id': brand.id, 'brand_name': brand.brand_name} for brand in Brand.objects.filter(brand_name__icontains=query).order_by('brand_name')[:10]] if query else [],
        }
        return Response(payload, status=status.HTTP_200_OK)


class CartAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        cart = self._get_cart(request)
        return Response(self._serialize_cart(cart), status=status.HTTP_200_OK)

    def _get_cart(self, request):
        customer = None
        if request.user.is_authenticated and request.user.is_active:
            customer = getattr(request.user, 'customer', None)
            if not customer:
                customer = Customer.objects.create(user=request.user)
        session_id = request.data.get('session_id') or request.headers.get('X-Session-ID') or request.META.get('HTTP_X_SESSION_ID') or request.session.session_key
        if customer:
            cart = ShoppingCart.objects.filter(customer=customer, status='Active').order_by('-created_at').first()
            if not cart:
                cart = ShoppingCart.objects.create(customer=customer, session_id=session_id or '', status='Active')
            elif session_id and not cart.session_id:
                cart.session_id = session_id
                cart.save(update_fields=['session_id'])
            return cart
        cart = None
        if session_id:
            cart = ShoppingCart.objects.filter(session_id=session_id, status='Active').order_by('-created_at').first()
        if not cart:
            cart = ShoppingCart.objects.create(session_id=session_id or '', status='Active')
        return cart

    def _serialize_cart(self, cart):
        items = []
        for item in cart.items.all():
            items.append({
                'id': item.id,
                'product_id': item.product.id,
                'product_name': item.product.product_name,
                'image_url': item.product.image_url,
                'price': float(item.unit_price),
                'quantity': item.quantity,
                'subtotal': float(item.subtotal),
            })
        return {
            'cart_id': cart.id,
            'items': items,
            'total_amount': float(cart.total_amount),
            'status': cart.status,
        }


class AddToCartAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = CartAddSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        cart = CartAPIView()._get_cart(request)
        product = Product.objects.filter(pk=serializer.validated_data['product_id']).first()
        if not product:
            return Response({'detail': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        quantity = serializer.validated_data['quantity']
        if product.quantity_in_stock < quantity:
            return Response({'detail': 'Requested quantity exceeds stock.'}, status=status.HTTP_400_BAD_REQUEST)

        item = cart.items.filter(product=product).first()
        if item:
            new_quantity = item.quantity + quantity
            if new_quantity > product.quantity_in_stock:
                return Response({'detail': 'Requested quantity exceeds stock.'}, status=status.HTTP_400_BAD_REQUEST)
            item.quantity = new_quantity
            item.unit_price = product.selling_price
            item.subtotal = product.selling_price * item.quantity
            item.save()
        else:
            item = cart.items.create(
                product=product,
                quantity=quantity,
                unit_price=product.selling_price,
                subtotal=product.selling_price * quantity,
            )

        cart.total_amount = sum((i.subtotal for i in cart.items.all()), Decimal('0.00'))
        cart.save(update_fields=['total_amount'])
        return Response({'message': 'Product added', 'cart_total': float(cart.total_amount)}, status=status.HTTP_200_OK)


class UpdateCartItemAPIView(APIView):
    permission_classes = [AllowAny]

    def patch(self, request):
        serializer = CartUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        cart = CartAPIView()._get_cart(request)
        item = cart.items.filter(pk=serializer.validated_data['cart_item_id']).first()
        if not item:
            return Response({'detail': 'Cart item not found.'}, status=status.HTTP_404_NOT_FOUND)

        new_quantity = serializer.validated_data['quantity']
        if new_quantity <= 0:
            item.delete()
        else:
            if new_quantity > item.product.quantity_in_stock:
                return Response({'detail': 'Requested quantity exceeds stock.'}, status=status.HTTP_400_BAD_REQUEST)
            item.quantity = new_quantity
            item.subtotal = item.unit_price * new_quantity
            item.save()

        cart.total_amount = sum((i.subtotal for i in cart.items.all()), Decimal('0.00'))
        cart.save(update_fields=['total_amount'])
        return Response(CartAPIView()._serialize_cart(cart), status=status.HTTP_200_OK)


class RemoveCartItemAPIView(APIView):
    permission_classes = [AllowAny]

    def delete(self, request, cart_item_id):
        cart = CartAPIView()._get_cart(request)
        item = cart.items.filter(pk=cart_item_id).first()
        if not item:
            return Response({'detail': 'Cart item not found.'}, status=status.HTTP_404_NOT_FOUND)
        item.delete()
        cart.total_amount = sum((i.subtotal for i in cart.items.all()), Decimal('0.00'))
        cart.save(update_fields=['total_amount'])
        return Response(CartAPIView()._serialize_cart(cart), status=status.HTTP_200_OK)


class ClearCartAPIView(APIView):
    permission_classes = [AllowAny]

    def delete(self, request):
        cart = CartAPIView()._get_cart(request)
        cart.items.all().delete()
        cart.total_amount = Decimal('0.00')
        cart.save(update_fields=['total_amount'])
        return Response({'message': 'Cart cleared.'}, status=status.HTTP_200_OK)


class MergeCartAPIView(APIView):
    permission_classes = [IsActiveUser]

    def post(self, request):
        serializer = CartMergeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        customer = getattr(request.user, 'customer', None)
        if not customer:
            customer = Customer.objects.create(user=request.user)

        session_id = serializer.validated_data.get('session_id') or request.headers.get('X-Session-ID') or request.META.get('HTTP_X_SESSION_ID')
        guest_cart = ShoppingCart.objects.filter(session_id=session_id, status='Active').order_by('-created_at').first() if session_id else None
        if not guest_cart:
            return Response({'message': 'No guest cart found.'}, status=status.HTTP_200_OK)

        cart = ShoppingCart.objects.filter(customer=customer, status='Active').order_by('-created_at').first()
        if not cart:
            cart = ShoppingCart.objects.create(customer=customer, session_id=session_id or '', status='Active')

        for item in guest_cart.items.all():
            new_item = cart.items.filter(product=item.product).first()
            if new_item:
                new_quantity = new_item.quantity + item.quantity
                if new_quantity > item.product.quantity_in_stock:
                    new_quantity = item.product.quantity_in_stock
                new_item.quantity = new_quantity
                new_item.unit_price = item.product.selling_price
                new_item.subtotal = item.product.selling_price * new_item.quantity
                new_item.save()
            else:
                cart.items.create(
                    product=item.product,
                    quantity=item.quantity,
                    unit_price=item.product.selling_price,
                    subtotal=item.product.selling_price * item.quantity,
                )

        cart.total_amount = sum((i.subtotal for i in cart.items.all()), Decimal('0.00'))
        cart.save(update_fields=['total_amount'])
        guest_cart.delete()
        return Response({'message': 'Guest cart merged successfully.', 'cart': CartAPIView()._serialize_cart(cart)}, status=status.HTTP_200_OK)


class OrderListAPIView(APIView):
    permission_classes = [IsActiveUser]

    def get(self, request):
        customer = getattr(request.user, 'customer', None)
        if not customer:
            customer = Customer.objects.create(user=request.user)
        orders = Order.objects.filter(customer=customer).order_by('-created_at')
        return Response([self._serialize_order(order) for order in orders], status=status.HTTP_200_OK)

    def _serialize_order(self, order):
        return {
            'id': order.id,
            'order_number': order.order_number,
            'total_amount': float(order.total_amount),
            'payment_method': order.payment_method,
            'payment_status': order.payment_status,
            'order_status': order.order_status,
            'created_at': order.created_at.isoformat(),
            'items': [
                {
                    'product_name': item.product_name,
                    'quantity': item.quantity,
                    'unit_price': float(item.unit_price),
                    'subtotal': float(item.subtotal),
                    'image_url': getattr(item.product, 'image_url', None),
                    'product_image': getattr(item.product, 'image_url', None),
                }
                for item in order.items.select_related('product').all()
            ],
            'image_urls': [
                getattr(item.product, 'image_url', None)
                for item in order.items.select_related('product').all()
                if getattr(item.product, 'image_url', None)
            ],
            'tracking_history': [
                {
                    'status': entry.status,
                    'title': entry.title,
                    'detail': entry.detail,
                    'timestamp': entry.created_at.isoformat(),
                }
                for entry in order.status_history.all()
            ],
        }


class CreateOrderAPIView(APIView):
    permission_classes = [IsActiveUser]

    def post(self, request):
        serializer = OrderCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        customer = getattr(request.user, 'customer', None)
        if not customer:
            customer = Customer.objects.create(user=request.user)

        cart = ShoppingCart.objects.filter(customer=customer, status='Active').order_by('-created_at').first()
        if not cart or not cart.items.exists():
            return Response({'detail': 'Cart is empty.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            for item in cart.items.all():
                if item.quantity > item.product.quantity_in_stock:
                    return Response({'detail': f"Insufficient stock for {item.product.product_name}."}, status=status.HTTP_400_BAD_REQUEST)

            order = Order.objects.create(
                customer=customer,
                order_number=f"ORD-{timezone.now().strftime('%Y%m%d%H%M%S')}-{request.user.id}",
                total_amount=cart.total_amount,
                delivery_fee=Decimal('0.00'),
                discount=Decimal('0.00'),
                tax=Decimal('0.00'),
                payment_method=serializer.validated_data.get('payment_method', 'PAY_ON_DELIVERY'),
                payment_status='Pending',
                order_status='Pending',
                delivery_address=serializer.validated_data.get('delivery_address', ''),
                phone_number=serializer.validated_data.get('phone_number', request.user.phone_number or ''),
                notes=serializer.validated_data.get('notes', ''),
            )

            _add_order_status_history(
                order,
                'Pending',
                'Order received',
                'Your order has been received and is awaiting seller confirmation.',
            )
            Notification.objects.create(
                user=request.user,
                title='Order received',
                message=f'Your order {order.order_number} has been received and is waiting for seller confirmation.',
                notification_type='order',
            )

            for item in cart.items.all():
                item.product.quantity_in_stock -= item.quantity
                if item.product.quantity_in_stock <= 0:
                    item.product.status = 'Out of Stock'
                else:
                    item.product.status = 'Available'
                item.product.save(update_fields=['quantity_in_stock', 'status'])
                OrderItem.objects.create(
                    order=order,
                    product=item.product,
                    product_name=item.product.product_name,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    subtotal=item.subtotal,
                )

            Payment.objects.create(
                order=order,
                payment_method=order.payment_method,
                amount=order.total_amount,
                payment_status='Pending',
            )
            Delivery.objects.create(order=order, delivery_status='Preparing')

            cart.items.all().delete()
            cart.total_amount = Decimal('0.00')
            cart.status = 'Converted'
            cart.save(update_fields=['total_amount', 'status'])

            admin_users = User.objects.filter(role='Admin', is_active=True)
            for admin_user in admin_users:
                Notification.objects.create(
                    user=admin_user,
                    title='New order received',
                    message=f'A new order {order.order_number} has been placed.',
                    notification_type='order',
                )

        return Response({'message': 'Order created successfully.', 'order': OrderListAPIView()._serialize_order(order)}, status=status.HTTP_201_CREATED)


class OrderDetailAPIView(APIView):
    permission_classes = [IsActiveUser]

    def get(self, request, order_id):
        order = Order.objects.filter(pk=order_id).first()
        if not order:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not request.user.is_staff and order.customer.user != request.user:
            return Response({'detail': 'You do not have permission to view this order.'}, status=status.HTTP_403_FORBIDDEN)
        return Response(self._serialize_order(order), status=status.HTTP_200_OK)

    def _serialize_order(self, order):
        return {
            'id': order.id,
            'order_number': order.order_number,
            'total_amount': float(order.total_amount),
            'delivery_fee': float(order.delivery_fee),
            'payment_method': order.payment_method,
            'payment_status': order.payment_status,
            'order_status': order.order_status,
            'delivery_address': order.delivery_address,
            'phone_number': order.phone_number,
            'notes': order.notes,
            'items': [
                {
                    'product_name': item.product_name,
                    'quantity': item.quantity,
                    'unit_price': float(item.unit_price),
                    'subtotal': float(item.subtotal),
                    'image_url': getattr(item.product, 'image_url', None),
                    'product_image': getattr(item.product, 'image_url', None),
                }
                for item in order.items.select_related('product').all()
            ],
            'image_urls': [
                getattr(item.product, 'image_url', None)
                for item in order.items.select_related('product').all()
                if getattr(item.product, 'image_url', None)
            ],
            'delivery': {
                'delivery_status': order.delivery.delivery_status if hasattr(order, 'delivery') and order.delivery else None,
                'delivery_person': order.delivery.delivery_person if hasattr(order, 'delivery') and order.delivery else None,
                'phone_number': order.delivery.delivery_phone if hasattr(order, 'delivery') and order.delivery else None,
            },
            'receipt': {
                'receipt_number': order.receipt.receipt_number if hasattr(order, 'receipt') and order.receipt else None,
                'pdf_url': order.receipt.pdf_url if hasattr(order, 'receipt') and order.receipt else None,
            },
            'tracking_history': [
                {
                    'status': entry.status,
                    'title': entry.title,
                    'detail': entry.detail,
                    'timestamp': entry.created_at.isoformat(),
                }
                for entry in order.status_history.all()
            ],
        }


class CancelOrderAPIView(APIView):
    permission_classes = [IsActiveUser]

    def patch(self, request, order_id):
        order = Order.objects.filter(pk=order_id).first()
        if not order:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)
        if order.customer.user != request.user:
            return Response({'detail': 'You do not have permission to cancel this order.'}, status=status.HTTP_403_FORBIDDEN)
        if order.order_status not in ['Pending', 'Confirmed']:
            return Response({'detail': 'Only pending or confirmed orders can be cancelled.'}, status=status.HTTP_400_BAD_REQUEST)

        order.order_status = 'Cancelled'
        order.save(update_fields=['order_status'])
        for item in order.items.all():
            item.product.quantity_in_stock += item.quantity
            if item.product.quantity_in_stock > 0:
                item.product.status = 'Available'
            item.product.save(update_fields=['quantity_in_stock', 'status'])
        return Response({'message': 'Order cancelled successfully.'}, status=status.HTTP_200_OK)


class AdminOrderListAPIView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        orders = Order.objects.all().order_by('-created_at')
        data = []
        for order in orders:
            data.append({
                'id': order.id,
                'customer': f"{order.customer.user.first_name} {order.customer.user.last_name}".strip() or order.customer.user.email,
                'order_number': order.order_number,
                'total_amount': float(order.total_amount),
                'payment_status': order.payment_status,
                'order_status': order.order_status,
                'items': [{'product_name': item.product_name, 'quantity': item.quantity} for item in order.items.all()],
            })
        return Response(data, status=status.HTTP_200_OK)


class AdminConfirmOrderAPIView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, order_id):
        order = Order.objects.filter(pk=order_id).first()
        if not order:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)
        if order.order_status != 'Pending':
            return Response({'detail': 'Only pending orders can be confirmed.'}, status=status.HTTP_400_BAD_REQUEST)
        order.order_status = 'Confirmed'
        order.save(update_fields=['order_status'])
        Notification.objects.create(
            user=order.customer.user,
            title='Order confirmed',
            message=f'Your order {order.order_number} has been confirmed.',
            notification_type='order',
        )
        return Response({'message': 'Order confirmed.'}, status=status.HTTP_200_OK)


class AdminUpdateOrderStatusAPIView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, order_id):
        serializer = OrderStatusSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        order = Order.objects.filter(pk=order_id).first()
        if not order:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)
        order.order_status = serializer.validated_data['status']
        order.save(update_fields=['order_status'])

        if order.order_status == 'Out for Delivery':
            delivery = getattr(order, 'delivery', None)
            if delivery:
                delivery.delivery_status = 'Out for Delivery'
                delivery.save(update_fields=['delivery_status'])
            _add_order_status_history(order, 'Out for Delivery', 'Out for delivery', 'Your order is on the way and a rider is heading to your address.')
        elif order.order_status == 'Delivered':
            delivery = getattr(order, 'delivery', None)
            if delivery:
                delivery.delivery_status = 'Delivered'
                delivery.delivery_date = timezone.now()
                delivery.save(update_fields=['delivery_status', 'delivery_date'])
            _add_order_status_history(order, 'Delivered', 'Delivered', 'Your order has been delivered successfully.')
        else:
            _add_order_status_history(order, order.order_status, f"Status updated to {order.order_status}", f"Your order is now {order.order_status}.")

        Notification.objects.create(
            user=order.customer.user,
            title='Order updated',
            message=f'Your order {order.order_number} is now {order.order_status}.',
            notification_type='order',
        )
        return Response({'message': 'Order status updated.'}, status=status.HTTP_200_OK)


class AdminUpdatePaymentAPIView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, order_id):
        serializer = PaymentUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        order = Order.objects.filter(pk=order_id).first()
        if not order:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)
        order.payment_status = serializer.validated_data['payment_status']
        order.save(update_fields=['payment_status'])
        return Response({'message': 'Payment status updated.'}, status=status.HTTP_200_OK)


class DeliveryAPIView(APIView):
    permission_classes = [IsActiveUser]

    def get(self, request, order_id):
        order = Order.objects.filter(pk=order_id).first()
        if not order:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not request.user.is_staff and order.customer.user != request.user:
            return Response({'detail': 'You do not have permission to view delivery details.'}, status=status.HTTP_403_FORBIDDEN)
        delivery = order.delivery if hasattr(order, 'delivery') else None
        if not delivery:
            return Response({'detail': 'No delivery record found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            'id': delivery.id,
            'delivery_status': delivery.delivery_status,
            'delivery_person': delivery.delivery_person,
            'phone_number': delivery.delivery_phone,
            'delivered_at': delivery.delivery_date.isoformat() if delivery.delivery_date else None,
        }, status=status.HTTP_200_OK)


class ReceiptAPIView(APIView):
    permission_classes = [IsActiveUser]

    def post(self, request, order_id):
        order = Order.objects.filter(pk=order_id).first()
        if not order:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not request.user.is_staff and order.customer.user != request.user:
            return Response({'detail': 'You do not have permission to generate a receipt.'}, status=status.HTTP_403_FORBIDDEN)

        receipt, created = Receipt.objects.get_or_create(
            order=order,
            defaults={
                'receipt_number': f"RCP-{order.id:06d}",
                'receipt_date': timezone.now(),
                'subtotal': order.total_amount,
                'tax': order.tax,
                'delivery_fee': order.delivery_fee,
                'total_amount': order.total_amount + order.delivery_fee + order.tax,
                'pdf_url': request.build_absolute_uri(f'/api/orders/{order.id}/receipt/'),
            },
        )
        return Response({
            'message': 'Receipt generated.' if created else 'Receipt already exists.',
            'receipt_number': receipt.receipt_number,
            'pdf_url': receipt.pdf_url,
        }, status=status.HTTP_200_OK)


class ReceiptDownloadAPIView(APIView):
    permission_classes = [IsActiveUser]

    def get(self, request, receipt_id):
        receipt = Receipt.objects.select_related('order', 'order__customer__user').filter(pk=receipt_id).first()
        if not receipt:
            return Response({'detail': 'Receipt not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not request.user.is_staff and receipt.order.customer.user != request.user:
            return Response({'detail': 'You do not have permission to download this receipt.'}, status=status.HTTP_403_FORBIDDEN)

        content = (
            f"Receipt Number: {receipt.receipt_number}\n"
            f"Customer: {receipt.order.customer.user.get_full_name() or receipt.order.customer.user.email}\n"
            f"Order Number: {receipt.order.order_number}\n"
            f"Amount: {receipt.total_amount}\n"
            f"Date: {receipt.receipt_date.isoformat()}\n"
        )
        path = default_storage.save(f'receipts/{receipt.receipt_number}.txt', ContentFile(content.encode('utf-8')))
        file_handle = default_storage.open(path, 'rb')
        response = FileResponse(file_handle, content_type='text/plain')
        response['Content-Disposition'] = f'attachment; filename="{receipt.receipt_number}.txt"'
        return response


class AdminReceiptEmailAPIView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, receipt_id):
        receipt = Receipt.objects.select_related('order', 'order__customer__user').filter(pk=receipt_id).first()
        if not receipt:
            return Response({'detail': 'Receipt not found.'}, status=status.HTTP_404_NOT_FOUND)

        to_email = request.data.get('email')
        if not to_email:
            return Response({'detail': 'Email address is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Build simple PDF in-memory
        buffer = BytesIO()
        p = canvas.Canvas(buffer)
        p.setFont('Helvetica', 12)
        p.drawString(50, 800, f"Receipt: {receipt.receipt_number}")
        p.drawString(50, 780, f"Order: {receipt.order.order_number}")
        p.drawString(50, 760, f"Customer: {receipt.order.customer.user.get_full_name() or receipt.order.customer.user.email}")
        p.drawString(50, 740, f"Amount: {receipt.total_amount}")
        p.drawString(50, 720, f"Date: {receipt.receipt_date.isoformat()}")
        p.showPage()
        p.save()
        buffer.seek(0)

        subject = f"Receipt {receipt.receipt_number}"
        body = f"Please find attached receipt {receipt.receipt_number}."
        email = EmailMessage(subject=subject, body=body, to=[to_email])
        email.attach(f"{receipt.receipt_number}.pdf", buffer.read(), 'application/pdf')
        try:
            email.send(fail_silently=False)
        except Exception as e:
            return Response({'detail': 'Failed to send email.', 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({'message': 'Email sent.'}, status=status.HTTP_200_OK)


class AdminReceiptPDFAPIView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, receipt_id):
        receipt = Receipt.objects.select_related('order', 'order__customer__user').filter(pk=receipt_id).first()
        if not receipt:
            return Response({'detail': 'Receipt not found.'}, status=status.HTTP_404_NOT_FOUND)

        buffer = BytesIO()
        p = canvas.Canvas(buffer)
        p.setFont('Helvetica', 12)
        p.drawString(50, 800, f"Receipt: {receipt.receipt_number}")
        p.drawString(50, 780, f"Order: {receipt.order.order_number}")
        p.drawString(50, 760, f"Customer: {receipt.order.customer.user.get_full_name() or receipt.order.customer.user.email}")
        p.drawString(50, 740, f"Amount: {receipt.total_amount}")
        p.drawString(50, 720, f"Date: {receipt.receipt_date.isoformat()}")
        p.showPage()
        p.save()
        buffer.seek(0)
        return FileResponse(buffer, as_attachment=True, filename=f"{receipt.receipt_number}.pdf")


def frontend_home(request):
    return render(request, 'frontend/home.html')


def dashboard_screen(request):
    return render(request, 'frontend/dashboard.html')


def products_screen(request):
    return render(request, 'frontend/products.html')


def categories_screen(request):
    return render(request, 'frontend/categories.html')


def brands_screen(request):
    return render(request, 'frontend/brands.html')


def inventory_screen(request):
    return render(request, 'frontend/inventory.html')


def customers_screen(request):
    return render(request, 'frontend/customers.html')


def orders_screen(request):
    return render(request, 'frontend/orders.html')


def payments_screen(request):
    return render(request, 'frontend/payments.html')


def deliveries_screen(request):
    return render(request, 'frontend/deliveries.html')


def receipts_screen(request):
    return render(request, 'frontend/receipts.html')


def reports_screen(request):
    return render(request, 'frontend/reports.html')


def register_screen(request):
    return render(request, 'frontend/register.html')


def login_screen(request):
    return render(request, 'frontend/login.html')


def forgot_password_screen(request):
    return render(request, 'frontend/forgot_password.html')


def reset_password_screen(request):
    return render(request, 'frontend/reset_password.html')


def profile_screen(request):
    return render(request, 'frontend/profile.html')

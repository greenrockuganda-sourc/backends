import base64
import csv
import io
import logging
import os
import re
from decimal import Decimal
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import json

import cloudinary
import qrcode
import cloudinary.uploader
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import IntegrityError, transaction
from django.db.models import F, Q, Sum
from django.http import FileResponse, HttpResponse
from django.template.loader import render_to_string
from django.conf import settings
from django.core.mail import EmailMessage
from email.mime.image import MIMEImage
import tempfile
from reportlab.pdfgen import canvas
from io import BytesIO
from django.shortcuts import redirect, render
from django.utils import timezone

try:
    from weasyprint import HTML, CSS
except ImportError:
    HTML = None
    CSS = None
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import status
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from .models import Brand, CartItem, Category, Customer, Delivery, Notification, PushToken, Order, OrderItem, OrderStatusHistory, Payment, Product, Recipe, Receipt, Review, ShoppingCart
from .serializers import (
    BrandSerializer,
    BrandWriteSerializer,
    CartAddSerializer,
    CartMergeSerializer,
    CartUpdateSerializer,
    CategorySerializer,
    CategoryWriteSerializer,
    CustomerWriteSerializer,
    DeliveryUpdateSerializer,
    ForgotPasswordSerializer,
    NotificationReadSerializer,
    PushTokenSerializer,
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

cloudinary_cloud_name = (os.getenv('CLOUDINARY_CLOUD_NAME') or '').strip()
cloudinary_api_key = (os.getenv('CLOUDINARY_API_KEY') or '').strip()
cloudinary_api_secret = (os.getenv('CLOUDINARY_API_SECRET') or '').strip()

if cloudinary_cloud_name and cloudinary_api_key and cloudinary_api_secret:
    cloudinary.config(
        cloud_name=cloudinary_cloud_name,
        api_key=cloudinary_api_key,
        api_secret=cloudinary_api_secret,
        secure=True,
    )
else:
    logging.getLogger(__name__).warning(
        'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in the environment.'
    )


def _build_receipt_qr_data_url(receipt_number):
    qr_payload = f'receipt:{receipt_number or "unknown"}'
    qr_code = qrcode.QRCode(version=1, box_size=10, border=4)
    qr_code.add_data(qr_payload)
    qr_code.make(fit=True)
    image = qr_code.make_image(fill_color='black', back_color='white')
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    encoded = base64.b64encode(buffer.getvalue()).decode('ascii')
    return f'data:image/png;base64,{encoded}'


def build_receipt_context(receipt):
    customer = receipt.order.customer.user
    items = []
    for item in receipt.order.items.select_related('product').all():
        product = getattr(item, 'product', None)
        image_url = None
        if product is not None:
            image_url = product.image_url or product.image_url_2 or product.image_url_3 or product.image_url_4

        items.append({
            'name': item.product_name or getattr(item.product, 'product_name', 'Item'),
            'product_name': item.product_name or getattr(item.product, 'product_name', 'Item'),
            'product': product,
            'quantity': item.quantity,
            'unit_price': float(item.unit_price),
            'subtotal': float(item.subtotal),
            'image_url': image_url,
        })

    receipt_number = getattr(receipt, 'receipt_number', '') or 'N/A'
    qr_payload = f'receipt:{receipt_number}'
    return {
        'receipt': receipt,
        'order': receipt.order,
        'customer': customer,
        'customer_name': customer.get_full_name() or customer.email,
        'items': items,
        'company_name': 'Glow',
        'company_address': '123 Salon Lane, Kampala',
        'company_email': 'support@glow.com',
        'company_phone': '+256 700 000 000',
        'qr_code_payload': qr_payload,
        'qr_code_data_url': _build_receipt_qr_data_url(receipt_number),
    }


def _fetch_inline_images_for_email(items):
    cid_map = {}
    attachments = []

    for index, item in enumerate(items):
        image_url = item.get('image_url')
        if not image_url or image_url in cid_map:
            continue

        try:
            request = Request(image_url, headers={'User-Agent': 'Mozilla/5.0'})
            data = urlopen(request, timeout=10).read()
            mime_image = MIMEImage(data)
            cid = f'product-image-{index + 1}'
            mime_image.add_header('Content-ID', f'<{cid}>')
            mime_image.add_header('Content-Disposition', 'inline', filename=f'product-{index + 1}.jpg')
            attachments.append((mime_image, cid))
            cid_map[image_url] = cid
        except Exception:
            continue

    return cid_map, attachments


def _generate_report_payload(report_type, start_date=None, end_date=None):
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
    elif report_type == 'categories':
        category_rows = []
        for category in Category.objects.prefetch_related('products__order_items__order').all().order_by('category_name'):
            revenue = Decimal('0.00')
            total_quantity = 0
            order_ids = set()
            for product in category.products.all():
                for item in product.order_items.all():
                    order = item.order
                    if not order:
                        continue
                    order_date = getattr(order.order_date, 'date', lambda: order.order_date)()
                    if start_date and order_date < start_date:
                        continue
                    if end_date and order_date > end_date:
                        continue
                    revenue += item.subtotal
                    total_quantity += item.quantity
                    order_ids.add(order.id)
            category_rows.append({
                'category_name': category.category_name,
                'total_orders': len(order_ids),
                'total_revenue': float(revenue),
                'total_quantity': total_quantity,
                'product_count': category.products.count(),
            })
        payload = {'categories': sorted(category_rows, key=lambda row: row['total_revenue'], reverse=True)[:20]}
    else:
        payload = None

    return payload


def _render_report_csv(report_type, payload):
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
    elif report_type == 'categories':
        writer.writerow(['category_name', 'total_orders', 'total_revenue', 'total_quantity', 'product_count'])
        for item in payload['categories']:
            writer.writerow([item['category_name'], item['total_orders'], item['total_revenue'], item['total_quantity'], item['product_count']])
    else:
        writer.writerow(['customer_name', 'orders', 'total_spend'])
        for item in payload['customers']:
            writer.writerow([item['customer_name'], item['orders'], item['total_spend']])

    return output.getvalue()


def _send_report_message(to_email, report_type, payload, frequency='daily', start_date=None, end_date=None, file_format=None):
    subject = f"{frequency.capitalize()} {report_type.capitalize()} Report"
    html = render_to_string('email/report_email.html', {
        'report_type': report_type,
        'payload': payload,
        'frequency': frequency,
        'start_date': start_date,
        'end_date': end_date,
    })
    email = EmailMessage(subject=subject, body=html, to=[to_email])
    email.content_subtype = 'html'

    if file_format in ('csv', 'excel'):
        content = _render_report_csv(report_type, payload).encode('utf-8')
        filename = f'{report_type}_report.{"xlsx" if file_format == "excel" else "csv"}'
        mime_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' if file_format == 'excel' else 'text/csv'
        email.attach(filename, content, mime_type)

    email.send(fail_silently=False)

    return email


def ensure_receipt_for_order(order, request=None):
    receipt, created = Receipt.objects.get_or_create(
        order=order,
        defaults={
            'receipt_number': f"RCP-{order.id:06d}",
            'receipt_date': timezone.now(),
            'subtotal': order.total_amount,
            'tax': order.tax,
            'delivery_fee': order.delivery_fee,
            'total_amount': order.total_amount + order.delivery_fee + order.tax,
        },
    )

    if not created:
        needs_update = False
        if receipt.subtotal != order.total_amount:
            receipt.subtotal = order.total_amount
            needs_update = True
        if receipt.tax != order.tax:
            receipt.tax = order.tax
            needs_update = True
        if receipt.delivery_fee != order.delivery_fee:
            receipt.delivery_fee = order.delivery_fee
            needs_update = True
        if receipt.total_amount != order.total_amount + order.delivery_fee + order.tax:
            receipt.total_amount = order.total_amount + order.delivery_fee + order.tax
            needs_update = True
        if not receipt.receipt_number:
            receipt.receipt_number = f"RCP-{order.id:06d}"
            needs_update = True
        if needs_update:
            receipt.save(update_fields=['subtotal', 'tax', 'delivery_fee', 'total_amount', 'receipt_number'])

    if request and not receipt.pdf_url:
        receipt.pdf_url = request.build_absolute_uri(f'/api/admin/receipts/{receipt.id}/pdf/')
        receipt.save(update_fields=['pdf_url'])

    return receipt, created


def build_receipt_printer_payload(receipt):
    order = receipt.order
    customer = order.customer.user
    customer_name = customer.get_full_name() or customer.email
    line_items = []
    for item in order.items.select_related('product').all():
        product_name = item.product_name or getattr(item.product, 'product_name', 'Item')
        line_items.append(f"{product_name} x{item.quantity} {item.subtotal}")

    lines = [
        'GROW SALON',
        'Professional Receipt',
        f'Receipt: {receipt.receipt_number}',
        f'Date: {receipt.receipt_date.strftime("%Y-%m-%d %H:%M")}',
        f'Order: {order.order_number}',
        f'Customer: {customer_name}',
        f'Phone: {order.phone_number or "N/A"}',
        '------------------------------',
    ]
    lines.extend(line_items or ['No items available.'])
    lines.extend([
        '------------------------------',
        f'Subtotal: {receipt.subtotal}',
        f'Tax: {receipt.tax}',
        f'Delivery: {receipt.delivery_fee}',
        f'Total: {receipt.total_amount}',
        'Thank you for shopping with GrowSalon',
        'Please come again.',
    ])
    return '\n'.join(lines)


def generate_receipt_pdf_bytes(receipt, request):
    html_content = render_to_string('receipt_pdf.html', build_receipt_context(receipt))
    if HTML is not None:
        try:
            css = CSS(string='''
                body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #1f2937; }
                .page { padding: 32px; }
                .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
                .company-brand { font-size: 1.5rem; font-weight: 700; color: #1d4ed8; }
                .subtitle { color: #475569; margin-top: 4px; }
                .panel { border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; margin-bottom: 18px; }
                .panel-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
                .panel h4 { margin: 0 0 8px; font-size: 0.95rem; color: #475569; }
                .panel p { margin: 0; font-size: 0.95rem; }
                table { width: 100%; border-collapse: collapse; margin-top: 14px; }
                th, td { padding: 12px 10px; border: 1px solid #e2e8f0; text-align: left; }
                th { background: #f1f5f9; }
                .total-row td { font-weight: 700; }
                .footer { margin-top: 24px; color: #475569; font-size: 0.92rem; }
            ''')
            pdf_bytes = HTML(string=html_content, base_url=request.build_absolute_uri('/')).write_pdf(stylesheets=[css])
            return pdf_bytes
        except Exception:
            pass

    buffer = BytesIO()
    p = canvas.Canvas(buffer)
    p.setFont('Helvetica-Bold', 16)
    p.drawString(50, 800, f"{receipt.receipt_number}")
    p.setFont('Helvetica', 11)
    p.drawString(50, 780, f"Order: {receipt.order.order_number}")
    p.drawString(50, 764, f"Customer: {receipt.order.customer.user.get_full_name() or receipt.order.customer.user.email}")
    p.drawString(50, 748, f"Amount: {receipt.total_amount}")
    p.drawString(50, 732, f"Date: {receipt.receipt_date.isoformat()}")
    p.showPage()
    p.save()
    buffer.seek(0)
    return buffer.read()


def upload_image_to_cloudinary(uploaded_file):
    if not uploaded_file:
        return None

    cloud_name = (os.getenv('CLOUDINARY_CLOUD_NAME') or '').strip()
    api_key = (os.getenv('CLOUDINARY_API_KEY') or '').strip()
    api_secret = (os.getenv('CLOUDINARY_API_SECRET') or '').strip()

    if not (cloud_name and api_key and api_secret):
        logging.getLogger(__name__).warning(
            'Cloudinary upload skipped because credentials are missing.'
        )
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
    except Exception as exc:
        logging.getLogger(__name__).exception('Cloudinary upload failed: %s', exc)
        return None


def _add_order_status_history(order, status, title, detail):
    return OrderStatusHistory.objects.create(order=order, status=status, title=title, detail=detail)


def generate_product_sku(product_name, exclude_product_id=None):
    normalized = re.sub(r'[^A-Za-z0-9]+', '-', (product_name or '').strip()).strip('-').upper()
    base = normalized or 'PRODUCT'
    sku = f'SKU-{base}'

    queryset = Product.objects.filter(sku=sku)
    if exclude_product_id is not None:
        queryset = queryset.exclude(pk=exclude_product_id)

    if not queryset.exists():
        return sku

    suffix = 2
    while True:
        candidate = f'{sku}-{suffix}'
        queryset = Product.objects.filter(sku=candidate)
        if exclude_product_id is not None:
            queryset = queryset.exclude(pk=exclude_product_id)
        if not queryset.exists():
            return candidate
        suffix += 1


def _build_tracking_url(order):
    base_url = (getattr(settings, 'ORDER_TRACKING_BASE_URL', '') or getattr(settings, 'TRACKING_BASE_URL', '') or '').strip()
    if not base_url:
        return None
    if not base_url.endswith('/'):
        base_url = f'{base_url}/'
    return f'{base_url}{order.order_number}'


def _get_order_notification_items(order):
    items = []
    for item in order.items.select_related('product').all():
        product = getattr(item, 'product', None)
        image_url = getattr(product, 'image_url', None) or getattr(product, 'image_url_2', None) or getattr(product, 'image_url_3', None)
        items.append({
            'name': getattr(item, 'product_name', None) or getattr(product, 'product_name', 'Product'),
            'quantity': getattr(item, 'quantity', 1),
            'unit_price': float(getattr(item, 'unit_price', 0) or 0),
            'subtotal': float(getattr(item, 'subtotal', 0) or 0),
            'image_url': image_url,
        })
    return items


def _build_order_status_message(order, status):
    tracking_url = _build_tracking_url(order)
    tracking_text = f' Track: {tracking_url}' if tracking_url else ''

    if status == 'Confirmed':
        subject = 'Glow | Order confirmed'
        message = f'Glow: your order {order.order_number} has been confirmed and is being prepared for dispatch.{tracking_text}'
    elif status == 'Out for Delivery':
        subject = 'Glow | Order out for delivery'
        message = f'Glow: your order {order.order_number} is on the way and is out for delivery.{tracking_text}'
    elif status == 'Delivered':
        subject = 'Glow | Order delivered'
        message = f'Glow: your order {order.order_number} has been delivered successfully. Thank you for shopping with Glow.{tracking_text}'
    else:
        subject = f'Glow | Order update: {status}'
        message = f'Glow: your order {order.order_number} is now {status}.{tracking_text}'

    return subject, message


def _send_order_status_email(order, subject, message):
    customer_user = getattr(getattr(order, 'customer', None), 'user', None)
    to_email = getattr(customer_user, 'email', None)
    if not to_email:
        return False

    tracking_url = _build_tracking_url(order)
    items = _get_order_notification_items(order)
    total_amount = float(order.total_amount or 0)
    customer_name = (customer_user.get_full_name() or customer_user.email or 'Customer').strip()
    status_label = order.order_status or 'Updated'
    delivery_address = getattr(order, 'delivery_address', None) or 'Delivery address not provided'
    order_date = getattr(order, 'order_date', None) or getattr(order, 'created_at', None)
    order_date_text = order_date.strftime('%d %b %Y') if order_date else 'N/A'
    order_time_text = order_date.strftime('%I:%M %p') if order_date else 'N/A'

    item_rows = ''.join(
        f"""
        <tr>
          <td style="padding: 16px 0; border-bottom: 1px solid #e5e7eb;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="{(item['image_url'] or 'https://placehold.co/80x80/f3f4f6/111827?text=Glow').strip()}" alt="{item['name']}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb; background: #f9fafb;" />
              <div>
                <div style="font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 2px;">{item['name']}</div>
                <div style="font-size: 11px; color: #6b7280;">Qty: {item['quantity']}</div>
              </div>
            </div>
          </td>
          <td style="padding: 16px 0; border-bottom: 1px solid #e5e7eb; color: #111827; text-align: right; font-size: 13px;">UGX {item['unit_price']:,.2f}</td>
          <td style="padding: 16px 0; border-bottom: 1px solid #e5e7eb; color: #111827; text-align: right; font-size: 13px;">UGX {item['subtotal']:,.2f}</td>
        </tr>
        """ for item in items
    ) or """
        <tr>
          <td colspan="3" style="padding: 12px 0; color: #6b7280; text-align: center; font-size: 12px;">No item details available.</td>
        </tr>
    """

    status_steps = """
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 22px;">
      <tr>
        <td width="25%" align="center" style="padding: 0 6px;">
          <div style="display:inline-block; width: 36px; height: 36px; border-radius: 50%; background: #f97316; color: #fff; font-size: 18px; line-height: 36px; font-weight: 700; text-align: center; box-shadow: 0 8px 18px rgba(249, 115, 22, 0.25);">✓</div>
          <div style="font-size: 12px; color: #0f172a; font-weight: 700; margin-top: 8px;">Order Confirmed</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">{order_date_text}</div>
          <div style="font-size: 11px; color: #64748b;">{order_time_text}</div>
        </td>
        <td width="25%" align="center" style="padding: 0 6px;">
          <div style="display:inline-block; width: 36px; height: 36px; border-radius: 50%; background: #e2e8f0; color: #0f172a; font-size: 18px; line-height: 36px; font-weight: 700; text-align: center;">⏳</div>
          <div style="font-size: 12px; color: #0f172a; font-weight: 700; margin-top: 8px;">Processing</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">In progress</div>
        </td>
        <td width="25%" align="center" style="padding: 0 6px;">
          <div style="display:inline-block; width: 36px; height: 36px; border-radius: 50%; background: #e2e8f0; color: #0f172a; font-size: 18px; line-height: 36px; font-weight: 700; text-align: center;">🚚</div>
          <div style="font-size: 12px; color: #0f172a; font-weight: 700; margin-top: 8px;">Out for Delivery</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Will be updated</div>
        </td>
        <td width="25%" align="center" style="padding: 0 6px;">
          <div style="display:inline-block; width: 36px; height: 36px; border-radius: 50%; background: #e2e8f0; color: #0f172a; font-size: 18px; line-height: 36px; font-weight: 700; text-align: center;">🏠</div>
          <div style="font-size: 12px; color: #0f172a; font-weight: 700; margin-top: 8px;">Delivered</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Estimated</div>
        </td>
      </tr>
    </table>
    """

    tracking_cta = f'<p style="margin: 12px 0 0;"><a href="{tracking_url}" style="display:inline-block; background-color:#f97316; color:#ffffff; text-decoration:none; padding: 12px 18px; border-radius: 8px; font-weight:700; font-size: 14px;">Track your order</a></p>' if tracking_url else ''

    html_content = f"""
    <html>
      <body style="margin:0; padding:0; background:#edf0f3; font-family: Arial, sans-serif; color:#111827;">
        <div style="max-width: 980px; margin: 24px auto; background: #f5f7fa; border: 1px solid #dfe7ee; border-radius: 12px; overflow: hidden; box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);">
          <div style="background: linear-gradient(135deg, #0d1c2d 0%, #163652 100%); padding: 26px 32px 20px; color: #fff;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="top" style="font-size: 16px; line-height: 1.2;">
                  <div style="font-size: 52px; line-height: 1; font-weight: 900; letter-spacing: 1px; color:#ffffff;">GLOW</div>
                  <div style="font-size: 12px; letter-spacing: 1.2px; color:#d8e0eb; margin-top: 8px; text-transform: uppercase;">Salon Supplies, Delivered.</div>
                </td>
                <td align="right" valign="middle" style="font-size: 13px; color:#d8e0eb; white-space: nowrap;">
                  <div style="font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #f9d8af; margin-bottom: 4px;">Glow essentials</div>
                  <div>Quality products for</div>
                  <div>professional results.</div>
                </td>
              </tr>
            </table>
          </div>

          <div style="background: #f3f5f8; padding: 30px 32px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="top" style="width: 58%; padding-right: 20px;">
                  <div style="display:inline-block; background:#fef3c7; color:#9a5d00; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; padding: 7px 10px; border-radius: 999px; margin-bottom: 14px;">Order status update</div>
                  <div style="font-size: 30px; line-height: 1.2; color: #0f172a; font-weight: 800; margin: 0 0 8px;">Hello {customer_name.split()[0] if customer_name.split() else customer_name},</div>
                  <div style="font-size: 30px; line-height: 1.2; color: #0f172a; font-weight: 800; margin: 0 0 10px;">Your order is {status_label.lower()}.</div>
                  <div style="font-size: 15px; color: #475569; line-height: 1.7; margin: 0 0 18px;">We've received your order and it's now being processed.<br />Here are your order details below.</div>

                  <div style="font-size: 15px; color: #111827; line-height: 1.7; margin-bottom: 18px;">
                    <span style="font-weight: 700;">Order Number:</span> <span style="font-weight: 800;">#{order.order_number}</span>
                    <span style="color: #64748b;"> | </span>
                    <span>Placed on: {order_date_text}</span>
                    <span style="color: #64748b;"> | </span>
                    <span>{order_time_text}</span>
                  </div>

                  <a href="{tracking_url or '#'}" style="display:inline-block; background:#f97316; color:#ffffff; text-decoration:none; font-weight:700; padding: 14px 22px; border-radius: 10px; font-size: 15px; box-shadow: 0 10px 18px rgba(249,115,22,0.22);">View Order Details →</a>
                </td>
                <td valign="bottom" align="right" style="width: 42%;">
                  <div style="position: relative; height: 220px;">
                    <div style="position:absolute; right:0; bottom:0; width: 330px; height: 170px; background: linear-gradient(135deg,#f9b36d 0%, #f6d1a5 100%); border-radius: 32px 0 0 32px; transform: skewX(-18deg); opacity: 0.85;"></div>
                    <div style="position:absolute; right: 28px; bottom: 20px; width: 235px; height: 155px; background: linear-gradient(135deg, #0f172a 0%, #2a4059 100%); border-radius: 18px; box-shadow: 0 22px 32px rgba(15,23,42,0.25); transform: rotate(-2deg); border: 1px solid rgba(255,255,255,0.1);">
                      <div style="position:absolute; left: 18px; top: 18px; font-size: 32px; line-height: 1; font-weight: 900; color:#ffffff; letter-spacing: 1px;">GLOW</div>
                      <div style="position:absolute; left: 18px; bottom: 18px; right: 18px; height: 46px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08);"></div>
                    </div>
                    <div style="position:absolute; right: 58px; bottom: 160px; font-size: 23px; font-weight: 900; color: #f97316; font-style: italic; transform: rotate(-12deg); line-height: 1.1; text-align: center;">Thanks for<br/>shopping with us!</div>
                  </div>
                </td>
              </tr>
            </table>
          </div>

          <div style="background: #0f2139; margin: 0 32px 24px; border-radius: 0 0 12px 12px; padding: 18px 20px;">
            <div style="font-size: 13px; color: #d8e0eb; margin-bottom: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">Your Order Status</div>
            {status_steps}
          </div>

          <div style="background: #ffffff; margin: 0 32px 26px; padding: 22px 16px 8px; border-radius: 10px; border: 1px solid #e5e7eb;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="top" style="width: 62%; padding-right: 18px;">
                  <div style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0 0 12px;">Order Summary</div>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                    <thead>
                      <tr>
                        <th align="left" style="padding: 10px 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em;">Product</th>
                        <th align="right" style="padding: 10px 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em;">Qty</th>
                        <th align="right" style="padding: 10px 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em;">Price</th>
                        <th align="right" style="padding: 10px 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em;">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item_rows}
                    </tbody>
                  </table>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 14px;">
                    <tr>
                      <td align="right" style="padding: 8px 0; font-size: 14px; color: #374151;">Subtotal</td>
                      <td align="right" style="padding: 8px 0; font-size: 14px; color: #111827; font-weight: 700;">UGX {total_amount:,.2f}</td>
                    </tr>
                    <tr>
                      <td align="right" style="padding: 8px 0; font-size: 14px; color: #374151;">Shipping Fee</td>
                      <td align="right" style="padding: 8px 0; font-size: 14px; color: #111827; font-weight: 700;">UGX 0.00</td>
                    </tr>
                    <tr>
                      <td align="right" style="padding: 12px 0 4px; font-size: 16px; color: #111827; font-weight: 800;">Total</td>
                      <td align="right" style="padding: 12px 0 4px; font-size: 16px; color: #111827; font-weight: 800;">UGX {total_amount:,.2f}</td>
                    </tr>
                  </table>
                </td>
                <td valign="top" style="width: 38%; padding-left: 18px;">
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
                    <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">Shipping Address</div>
                    <div style="font-size: 14px; color: #334155; line-height: 1.7;">{delivery_address}</div>
                  </div>
                  <div style="background: linear-gradient(135deg, #0f2139 0%, #163a61 100%); border-radius: 12px; padding: 18px 16px; color: #ffffff;">
                    <div style="font-size: 20px; font-weight: 800; margin-bottom: 8px;">Track Your Order</div>
                    <div style="font-size: 13px; color: #dbeafe; margin-bottom: 14px;">Get real-time updates on your delivery status.</div>
                    <a href="{tracking_url or '#'}" style="display:inline-block; background:#f97316; color:#ffffff; text-decoration:none; font-weight:700; padding: 12px 16px; border-radius: 8px; font-size: 14px;">Track Order →</a>
                  </div>
                  <div style="margin-top: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px;">
                    <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 10px;">Need Help?</div>
                    <div style="font-size: 13px; color: #475569; line-height: 1.7;">Our support team is here for you.<br />+256 700 123 456<br />support@glow.com<br />Live Chat (Mon - Fri, 8AM - 6PM)</div>
                  </div>
                </td>
              </tr>
            </table>
          </div>

          <div style="background: linear-gradient(135deg, #0e1d32 0%, #12314c 100%); color: #ffffff; padding: 18px 32px 24px; font-size: 13px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size: 30px; line-height: 1; font-weight: 900; letter-spacing: 1px;">GLOW</td>
                <td align="right" style="font-size: 12px; color: #d8e0eb;">Help Center &nbsp; | &nbsp; Returns &nbsp; | &nbsp; Privacy Policy &nbsp; | &nbsp; Contact Us</td>
              </tr>
              <tr>
                <td colspan="2" style="padding-top: 12px; font-size: 12px; color: #d8e0eb; text-align: center;">
                  © 2025 Glow. All rights reserved.<br />Professional products. Better results.
                </td>
              </tr>
            </table>
          </div>
        </div>
      </body>
    </html>
    """

    try:
        email = EmailMessage(subject=subject, body=html_content, to=[to_email])
        email.content_subtype = 'html'
        email.send(fail_silently=False)
        return True
    except Exception:
        return False


def _send_sms_to_phone(phone_number, message, *, context_label='contact'):
    if not phone_number:
        return False

    phone_number = str(phone_number).strip()
    if phone_number.startswith('0'):
        phone_number = f'+256{phone_number[1:]}'
    elif not phone_number.startswith('+'):
        phone_number = f'+{phone_number}'

    account_sid = (getattr(settings, 'TWILIO_ACCOUNT_SID', '') or os.getenv('TWILIO_ACCOUNT_SID', '') or '').strip()
    auth_token = (getattr(settings, 'TWILIO_AUTH_TOKEN', '') or os.getenv('TWILIO_AUTH_TOKEN', '') or '').strip()
    from_number = (getattr(settings, 'TWILIO_PHONE_NUMBER', '') or os.getenv('TWILIO_PHONE_NUMBER', '') or '').strip()

    if not account_sid or not auth_token or not from_number:
        logging.getLogger(__name__).info('Twilio SMS credentials are not configured for %s.', context_label)
        return False

    payload = urlencode({'To': phone_number, 'From': from_number, 'Body': message}).encode('utf-8')
    auth_header = base64.b64encode(f'{account_sid}:{auth_token}'.encode('utf-8')).decode('ascii')
    request = Request(
        f'https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json',
        data=payload,
        headers={'Authorization': f'Basic {auth_header}', 'Content-Type': 'application/x-www-form-urlencoded'},
        method='POST',
    )

    try:
        with urlopen(request, timeout=10) as response:
            return response.status < 400
    except Exception:
        return False


def _send_order_status_sms(order, message):
    customer_user = getattr(getattr(order, 'customer', None), 'user', None)
    phone_number = getattr(customer_user, 'phone_number', None) or getattr(order, 'phone_number', None)
    return _send_sms_to_phone(phone_number, message, context_label=f'order {getattr(order, "order_number", "unknown")}')


def _send_email_to_user(user, subject, message):
    email = getattr(user, 'email', None)
    if not email:
        return False

    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #111827;">
        <h2>Glow</h2>
        <p>Hi {user.get_full_name() or email},</p>
        <p>{message}</p>
      </body>
    </html>
    """

    try:
        email_message = EmailMessage(subject=subject, body=html_content, to=[email])
        email_message.content_subtype = 'html'
        email_message.send(fail_silently=False)
        return True
    except Exception:
        return False


def _notify_user_contact(user, subject, message):
    if not user:
        return False

    sent = False
    phone_number = getattr(user, 'phone_number', None)
    if phone_number:
        sent = _send_sms_to_phone(phone_number, message, context_label=f'user {getattr(user, "email", "unknown")}') or sent

    if getattr(user, 'email', None):
        sent = _send_email_to_user(user, subject, message) or sent

    return sent


def _get_user_preferred_contact_method(user):
    try:
        method = cache.get(f'login_method:{getattr(user, "id", None)}')
        if method in ('email', 'phone'):
            return method
    except Exception:
        pass

    # fallback to available contact info
    if getattr(user, 'phone_number', None):
        return 'phone'
    if getattr(user, 'email', None):
        return 'email'
    return None


def _notify_user_preferred(order, subject, message):
    """Send order status notification using the user's preferred channel.

    Preference is stored in cache when the user logs in; if absent we
    fall back to phone when available, otherwise email. If the preferred
    channel fails, we attempt the other channel as a best-effort fallback.
    """
    customer_user = getattr(getattr(order, 'customer', None), 'user', None)
    preferred = _get_user_preferred_contact_method(customer_user)

    if preferred == 'phone':
        sent = _send_order_status_sms(order, message)
        if sent:
            return True
        # fallback to email
        return _send_order_status_email(order, subject, message)

    if preferred == 'email':
        sent = _send_order_status_email(order, subject, message)
        if sent:
            return True
        # fallback to sms
        return _send_order_status_sms(order, message)

    # no preference; choose based on available data
    phone = getattr(customer_user, 'phone_number', None) or getattr(order, 'phone_number', None)
    if phone:
        sent = _send_order_status_sms(order, message)
        if sent:
            return True
    return _send_order_status_email(order, subject, message)


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


def order_tracking_page(request, order_number):
    order = Order.objects.select_related('customer__user').filter(order_number=order_number).first()
    if not order:
        return render(request, 'order_tracking.html', {'order': None, 'not_found': True}, status=404)

    history = order.status_history.all()
    return render(request, 'order_tracking.html', {
        'order': order,
        'customer': order.customer.user,
        'history': history,
        'tracking_url': _build_tracking_url(order),
        'not_found': False,
    })


class RegisterAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            return Response(
                {
                    'message': 'Account created successfully.',
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                    'user': UserSerializer(user).data,
                },
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

        # Record the method the user used to sign in (email vs phone) so we
        # can prefer that channel for order status notifications. Stored in
        # cache to avoid touching the user model and migrations.
        try:
            method = 'email' if '@' in identifier else 'phone'
            cache.set(f'login_method:{user.id}', method, timeout=60 * 60 * 24 * 30)  # 30 days
        except Exception:
            pass

        # Customer accounts also use the mobile API, so issue JWTs for every
        # active, authenticated user. Admin-only permissions stay enforced on
        # the management endpoints themselves.
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        # Cookies support browser clients, while returning the tokens keeps the
        # dashboard and mobile clients (which use Authorization headers) able
        # to authenticate subsequent API requests.
        response = Response(
            {
                'access': access_token,
                'refresh': refresh_token,
                'user': UserSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )

        cookie_kwargs = {
            'httponly': getattr(settings, 'SESSION_COOKIE_HTTPONLY', True),
            'secure': getattr(settings, 'SESSION_COOKIE_SECURE', not settings.DEBUG),
            'samesite': getattr(settings, 'SESSION_COOKIE_SAMESITE', 'Strict'),
            'path': '/',
        }

        response.set_cookie(
            'access',
            access_token,
            max_age=int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
            **cookie_kwargs,
        )
        response.set_cookie(
            'refresh',
            refresh_token,
            max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
            **cookie_kwargs,
        )

        return response


class LogoutAPIView(APIView):
    permission_classes = [IsActiveUser]

    def post(self, request):
        refresh_token = request.data.get('refresh') or request.COOKIES.get('refresh')
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass

        response = Response({'message': 'Logged out successfully.'}, status=status.HTTP_200_OK)
        # Delete auth cookies
        response.delete_cookie('access', path='/')
        response.delete_cookie('refresh', path='/')
        return response


class RefreshAPIView(TokenRefreshView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        refresh_token = request.data.get('refresh') or request.COOKIES.get('refresh')
        if not refresh_token:
            return Response({'detail': 'Refresh token not provided.'}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = self.get_serializer(data={'refresh': refresh_token})
        try:
            serializer.is_valid(raise_exception=True)
        except Exception:
            return Response({'detail': 'Invalid refresh token.'}, status=status.HTTP_401_UNAUTHORIZED)

        access = serializer.validated_data.get('access')

        response = Response({'detail': 'Token refreshed.'}, status=status.HTTP_200_OK)
        cookie_kwargs = {
            'httponly': getattr(settings, 'SESSION_COOKIE_HTTPONLY', True),
            'secure': getattr(settings, 'SESSION_COOKIE_SECURE', not settings.DEBUG),
            'samesite': getattr(settings, 'SESSION_COOKIE_SAMESITE', 'Strict'),
            'path': '/',
        }
        response.set_cookie('access', access, max_age=int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()), **cookie_kwargs)
        if 'refresh' in serializer.validated_data:
            response.set_cookie('refresh', serializer.validated_data['refresh'], max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()), **cookie_kwargs)

        return response


class ForgotPasswordAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        identifier = serializer.validated_data['identifier']
        user = User.objects.filter(Q(email__iexact=identifier) | Q(phone_number=identifier)).first()
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
        moving_order_statuses = ['Confirmed', 'Processing', 'Packed', 'Out for Delivery', 'Delivered']
        queryset = (
            Product.objects
            .select_related('category', 'brand')
            .filter(status='Available')
            .annotate(sales_count=Sum(
                'order_items__quantity',
                filter=Q(order_items__order__order_status__in=moving_order_statuses),
            ))
            .order_by('-sales_count', '-updated_at')[:60]
        )
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


class PublicProductCatalogAPIView(APIView):
    """Read-only, shopper-safe product catalog with pagination.

    The administrative products endpoint is intentionally protected.  Mobile
    shoppers use this endpoint instead so their catalog is not limited to the
    small best-seller rail on the home screen.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        try:
            page = max(1, int(request.query_params.get('page', 1) or 1))
        except (TypeError, ValueError):
            page = 1

        try:
            page_size = int(request.query_params.get('page_size', 100) or 100)
        except (TypeError, ValueError):
            page_size = 100
        page_size = max(1, min(page_size, 100))

        queryset = (
            Product.objects
            .select_related('category', 'brand')
            .annotate(sales_count=Sum(
                'order_items__quantity',
                filter=Q(order_items__order__order_status__in=[
                    'Confirmed', 'Processing', 'Packed', 'Out for Delivery', 'Delivered',
                ]),
            ))
            .order_by('-updated_at', '-id')
        )
        count = queryset.count()
        start = (page - 1) * page_size
        results = ProductSerializer(queryset[start:start + page_size], many=True).data

        return Response({
            'count': count,
            'page': page,
            'page_size': page_size,
            'next': page < ((count + page_size - 1) // page_size),
            'results': results,
        }, status=status.HTTP_200_OK)


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
        cache_key = f'dashboard:{request.user.id}:{today.isoformat()}'
        cached_payload = cache.get(cache_key)
        if cached_payload is not None:
            return Response(cached_payload, status=status.HTTP_200_OK)

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

        payload = {
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
        }
        cache.set(cache_key, payload, 300)
        return Response(payload, status=status.HTTP_200_OK)


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
        image_url_2 = validated.get('image_url_2') or ''
        image_url_3 = validated.get('image_url_3') or ''
        image_url_4 = validated.get('image_url_4') or ''
        uploaded_images = request.FILES.getlist('images') or []
        # Accept frontend-provided image URLs in an `images` or `image_urls` array
        images_from_body = request.data.get('images') or request.data.get('image_urls')
        if isinstance(images_from_body, (list, tuple)) and not uploaded_images:
            # map up to 4 provided URLs into the image fields
            provided = [u for u in images_from_body if u]
            image_url, image_url_2, image_url_3, image_url_4 = (provided + ['', '', '', ''])[:4]
        if not uploaded_images and 'image' in request.FILES:
            uploaded_images = [request.FILES['image']]

        uploaded_urls = []
        for uploaded in uploaded_images[:4]:
            uploaded_url = upload_image_to_cloudinary(uploaded)
            if not uploaded_url:
                path = default_storage.save(f'products/{uploaded.name}', uploaded)
                uploaded_url = request.build_absolute_uri(default_storage.url(path))
            if uploaded_url:
                uploaded_urls.append(uploaded_url)

        if uploaded_urls:
            image_url, image_url_2, image_url_3, image_url_4 = (uploaded_urls + ['', '', '', ''])[:4]

        product_name = validated.get('product_name') or 'New Product'
        requested_sku = (validated.get('sku') or '').strip()
        if requested_sku and Product.objects.filter(sku=requested_sku).exists():
            return Response({'sku': ['A product with this SKU already exists.']}, status=status.HTTP_400_BAD_REQUEST)

        try:
            product = Product.objects.create(
                category=category,
                brand=brand,
                product_name=product_name,
                description=validated.get('description') or '',
                barcode=validated.get('barcode') or '',
                sku=requested_sku or generate_product_sku(product_name),
                buying_price=validated.get('buying_price') or Decimal('0.00'),
                selling_price=validated.get('selling_price') or Decimal('0.00'),
                quantity_in_stock=validated.get('quantity_in_stock') or 0,
                reorder_level=validated.get('reorder_level') or 0,
                image_url=image_url,
                image_url_2=image_url_2,
                image_url_3=image_url_3,
                image_url_4=image_url_4,
                weight=validated.get('weight'),
                unit=validated.get('unit') or '',
                status=validated.get('status') or ('Out of Stock' if (validated.get('quantity_in_stock') or 0) <= 0 else 'Available'),
            )
        except IntegrityError:
            return Response(
                {'detail': 'A product with the same SKU or barcode already exists.'},
                status=status.HTTP_400_BAD_REQUEST,
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
        product_name = validated.get('product_name')
        if product_name is not None:
            product.product_name = product_name
        if validated.get('description') is not None:
            product.description = validated['description']
        if validated.get('barcode') is not None:
            product.barcode = validated['barcode']
        if validated.get('sku') is not None:
            duplicate_sku = Product.objects.filter(sku=validated['sku']).exclude(pk=product.pk).exists()
            if duplicate_sku:
                return Response({'sku': ['A product with this SKU already exists.']}, status=status.HTTP_400_BAD_REQUEST)
            product.sku = validated['sku']
        elif product_name is not None:
            product.sku = generate_product_sku(product_name, exclude_product_id=product.id)
        if validated.get('buying_price') is not None:
            product.buying_price = validated['buying_price']
        if validated.get('selling_price') is not None:
            product.selling_price = validated['selling_price']
        if validated.get('quantity_in_stock') is not None:
            product.quantity_in_stock = validated['quantity_in_stock']
        if validated.get('reorder_level') is not None:
            product.reorder_level = validated['reorder_level']
        # Accept individual image_url fields if provided
        if validated.get('image_url') is not None:
            product.image_url = validated['image_url']
        if validated.get('image_url_2') is not None:
            product.image_url_2 = validated['image_url_2']
        if validated.get('image_url_3') is not None:
            product.image_url_3 = validated['image_url_3']
        if validated.get('image_url_4') is not None:
            product.image_url_4 = validated['image_url_4']

        # Accept frontend-provided image URLs array in `images` or `image_urls`
        images_from_body = request.data.get('images') or request.data.get('image_urls')
        if isinstance(images_from_body, (list, tuple)):
            provided = [u for u in images_from_body if u]
            product.image_url, product.image_url_2, product.image_url_3, product.image_url_4 = (provided + ['', '', '', ''])[:4]

        uploaded_images = request.FILES.getlist('images') or []
        if not uploaded_images and 'image' in request.FILES:
            uploaded_images = [request.FILES['image']]

        if uploaded_images:
            uploaded_urls = []
            for uploaded in uploaded_images[:4]:
                uploaded_url = upload_image_to_cloudinary(uploaded)
                if not uploaded_url:
                    path = default_storage.save(f'products/{uploaded.name}', uploaded)
                    uploaded_url = request.build_absolute_uri(default_storage.url(path))
                if uploaded_url:
                    uploaded_urls.append(uploaded_url)
            if uploaded_urls:
                product.image_url, product.image_url_2, product.image_url_3, product.image_url_4 = (uploaded_urls + ['', '', '', ''])[:4]

        if validated.get('weight') is not None:
            product.weight = validated['weight']
        if validated.get('unit') is not None:
            product.unit = validated['unit']
        if validated.get('status') is not None:
            product.status = validated['status']
        elif product.quantity_in_stock <= 0:
            product.status = 'Out of Stock'
        else:
            product.status = 'Available'

        try:
            product.save()
        except IntegrityError:
            return Response(
                {'detail': 'A product with the same SKU or barcode already exists.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if request.user and getattr(request.user, 'phone_number', None) or getattr(request.user, 'email', None):
            subject = f'Product status updated: {product.product_name}'
            message = f"Your product '{product.product_name}' status has been updated to {product.status}."
            _notify_user_contact(request.user, subject, message)

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
        return Response(CategorySerializer(categories, many=True).data, status=status.HTTP_200_OK)

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
    def get_permissions(self):
        # Brand names and logos are needed to browse the public mobile catalog;
        # create operations remain restricted to administrators.
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAdminUser()]

    def get(self, request):
        brands = Brand.objects.all().order_by('brand_name')
        return Response(BrandSerializer(brands, many=True).data, status=status.HTTP_200_OK)

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
        data = []
        for delivery in deliveries:
            order = getattr(delivery, 'order', None)
            customer_name = ''
            salon_name = ''
            address = ''
            if order:
                customer_name = f"{order.customer.user.first_name} {order.customer.user.last_name}".strip() or order.customer.user.email
                salon_name = order.customer.salon_name or ''
                address = order.delivery_address or order.customer.address or ''

            receipt_exists = False
            try:
                receipt_exists = Receipt.objects.filter(order=order).exists()
            except Exception:
                receipt_exists = False

            status_map = {
                'Preparing': 'pending',
                'Pending': 'pending',
                'Out for Delivery': 'in-transit',
                'In Transit': 'in-transit',
                'Delivered': 'delivered',
                'Cancelled': 'failed',
            }
            s = (delivery.delivery_status or '').strip()
            normalized_status = status_map.get(s, s.lower() or 'pending')

            data.append({
                'id': str(delivery.id),
                'orderId': str(order.id) if order else None,
                'orderNumber': order.order_number if order else None,
                'customer': customer_name,
                'customer_name': customer_name,
                'salon_name': salon_name,
                'deliveryPersonName': delivery.delivery_person,
                'deliveryPersonPhone': delivery.delivery_phone,
                'location': address,
                'address': address,
                'delivery_address': address,
                'estimatedDeliveryTime': delivery.estimated_delivery_time.isoformat() if getattr(delivery, 'estimated_delivery_time', None) else None,
                'status': normalized_status,
                'receiptIssued': bool(receipt_exists),
            })

        return Response(data, status=status.HTTP_200_OK)

    def post(self, request):
        # Create a new delivery record from dashboard form
        order_number = (request.data.get('orderNumber') or request.data.get('order_number') or '').strip()
        delivery_person = (request.data.get('deliveryPersonName') or request.data.get('delivery_person_name') or '').strip()
        delivery_phone = (request.data.get('deliveryPersonPhone') or request.data.get('delivery_person_phone') or '').strip()
        location = (request.data.get('location') or '').strip()
        est_time = request.data.get('estimatedDeliveryTime') or request.data.get('estimated_delivery_time')
        status_in = (request.data.get('status') or '').strip()

        if not order_number:
            return Response({'detail': 'orderNumber is required.'}, status=status.HTTP_400_BAD_REQUEST)

        order = Order.objects.filter(order_number=order_number).first()
        if not order:
            return Response({'detail': 'Order not found for provided orderNumber.'}, status=status.HTTP_404_NOT_FOUND)

        # Map frontend status values back to model status options
        rev_status_map = {
            'pending': 'Preparing',
            'in-transit': 'Out for Delivery',
            'delivered': 'Delivered',
            'failed': 'Cancelled',
        }
        delivery_status = rev_status_map.get(status_in, status_in or 'Preparing')

        try:
            delivery = Delivery.objects.create(
                order=order,
                delivery_status=delivery_status,
                delivery_person=delivery_person or None,
                delivery_phone=delivery_phone or None,
                estimated_delivery_time=est_time or None,
            )
        except Exception:
            logging.exception('Failed to create delivery')
            return Response({'detail': 'Failed to create delivery.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            'id': str(delivery.id),
            'orderId': str(order.id),
            'orderNumber': order.order_number,
            'deliveryPersonName': delivery.delivery_person,
            'deliveryPersonPhone': delivery.delivery_phone,
            'location': order.delivery_address,
            'estimatedDeliveryTime': delivery.estimated_delivery_time.isoformat() if delivery.estimated_delivery_time else None,
            'status': status_in or 'pending',
            'receiptIssued': False,
        }, status=status.HTTP_201_CREATED)


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
            status_map = {
                'Preparing': 'Pending',
                'Packed': 'Packed',
                'Out for Delivery': 'Out for Delivery',
                'Delivered': 'Delivered',
            }
            if delivery.order and delivery.delivery_status in status_map:
                delivery.order.order_status = status_map[delivery.delivery_status]
                delivery.order.save(update_fields=['order_status'])
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


class DeliveryReceiptAPIView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, delivery_id):
        delivery = Delivery.objects.filter(pk=delivery_id).select_related('order').first()
        if not delivery:
            return Response({'detail': 'Delivery not found.'}, status=status.HTTP_404_NOT_FOUND)

        order = getattr(delivery, 'order', None)
        if not order:
            return Response({'detail': 'Associated order not found.'}, status=status.HTTP_404_NOT_FOUND)

        receipt, created = ensure_receipt_for_order(order, request=request)

        return Response({
            'id': receipt.id,
            'receipt_number': receipt.receipt_number,
            'order_id': order.id,
            'total_amount': float(receipt.total_amount),
            'created': created,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class AdminReceiptListAPIView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        receipts = Receipt.objects.select_related('order', 'order__customer__user').all().order_by('-created_at')
        data = []
        for receipt in receipts:
            order = receipt.order
            customer_name = (order.customer.user.get_full_name() or order.customer.user.email) if order and getattr(order, 'customer', None) else 'Guest'
            address = (order.delivery_address or getattr(order.customer, 'address', '') or '') if order and getattr(order, 'customer', None) else ''
            order_items = order.items.select_related('product').all() if order else []
            item_rows = [
                {
                    'product_name': item.product_name or getattr(item.product, 'product_name', 'Item'),
                    'quantity': item.quantity,
                    'unit_price': float(item.unit_price),
                    'subtotal': float(item.subtotal),
                }
                for item in order_items
            ]
            data.append({
                'id': receipt.id,
                'receipt_number': receipt.receipt_number,
                'customer': customer_name,
                'customer_name': customer_name,
                'salon_name': getattr(getattr(order, 'customer', None), 'salon_name', '') if order and getattr(order, 'customer', None) else '',
                'address': address,
                'delivery_address': address,
                'order_number': order.order_number if order else 'N/A',
                'amount': float(receipt.total_amount or Decimal('0.00')),
                'date': (receipt.receipt_date or receipt.created_at).isoformat() if (receipt.receipt_date or receipt.created_at) else '',
                'items': item_rows,
            })
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


class RegisterPushTokenAPIView(APIView):
    """Register or update an Expo/device push token.

    Accepts JSON: { "token": "ExpoPushToken[...]", "device_info": "optional" }
    If the request is authenticated, the token will be associated with the user.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        token = (request.data.get('token') or '').strip()
        device_info = (request.data.get('device_info') or request.data.get('device') or '').strip()
        if not token:
            return Response({'detail': 'Token is required.'}, status=status.HTTP_400_BAD_REQUEST)

        defaults = {'device_info': device_info}
        if request.user and getattr(request.user, 'is_authenticated', False):
            defaults['user'] = request.user

        try:
            obj, created = PushToken.objects.update_or_create(token=token, defaults=defaults)
        except Exception:
            return Response({'detail': 'Unable to save token.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Ensure association if already existed without user but now authenticated
        if request.user and getattr(request.user, 'is_authenticated', False) and obj.user != request.user:
            obj.user = request.user
            obj.device_info = device_info or obj.device_info
            obj.save(update_fields=['user', 'device_info', 'updated_at'])

        return Response({'token': obj.token}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class BroadcastNotificationAPIView(APIView):
    """Allow sellers/admins to broadcast a notification to all customer users.

    POST payload:
    {
        "title": "...",
        "message": "...",
        "notification_type": "optional",
        "channel": "email|sms|both|push|all"
    }
    """

    permission_classes = [IsAdminUser]

    def post(self, request):
        title = (request.data.get('title') or '').strip()
        message = (request.data.get('message') or '').strip()
        notification_type = (request.data.get('notification_type') or '').strip()
        channel = (request.data.get('channel') or request.data.get('delivery_method') or 'both').strip().lower()

        if not title or not message:
            return Response({'detail': 'Both title and message are required.'}, status=status.HTTP_400_BAD_REQUEST)

        channels = {'email', 'sms'}
        if channel in {'push', 'notification'}:
            channels = {'push'}
        elif channel == 'email':
            channels = {'email'}
        elif channel == 'sms':
            channels = {'sms'}
        elif channel in {'all', 'both', 'email_sms', 'email_and_sms'}:
            channels = {'email', 'sms'}

        customers = Customer.objects.select_related('user').all()
        users = [c.user for c in customers if getattr(c, 'user', None)]

        notifications = []
        for user in users:
            notifications.append(Notification(user=user, title=title, message=message, notification_type=notification_type or None))
        try:
            Notification.objects.bulk_create(notifications)
        except Exception:
            logging.exception('Failed to create notification records')

        email_sent = 0
        sms_sent = 0
        if 'email' in channels:
            for user in users:
                if getattr(user, 'email', None):
                    subject = f'Glow | {title}'
                    if _send_email_to_user(user, subject, message):
                        email_sent += 1

        if 'sms' in channels:
            for user in users:
                phone_number = getattr(user, 'phone_number', None)
                if phone_number:
                    sms_text = f'Glow: {title} - {message}'
                    if _send_sms_to_phone(phone_number, sms_text, context_label=f'broadcast to {getattr(user, "email", "unknown")}'):
                        sms_sent += 1

        sent = 0
        if 'push' in channels:
            try:
                tokens = list(PushToken.objects.filter(user__in=users).values_list('token', flat=True).distinct())
            except Exception:
                tokens = []
                logging.exception('Failed to load push tokens for broadcast')

            if tokens:
                expo_url = 'https://exp.host/--/api/v2/push/send'
                messages = []
                for t in tokens:
                    messages.append({
                        'to': t,
                        'sound': 'default',
                        'title': title,
                        'body': message,
                        'data': {'type': notification_type or 'broadcast'},
                    })

                chunk_size = 100
                for i in range(0, len(messages), chunk_size):
                    chunk = messages[i:i+chunk_size]
                    try:
                        req = Request(expo_url, data=json.dumps(chunk).encode('utf-8'), headers={'Accept': 'application/json', 'Content-Type': 'application/json'})
                        urlopen(req, timeout=10)
                        sent += len(chunk)
                    except Exception:
                        logging.exception('Failed to send push chunk')

        return Response({
            'message': 'Broadcast queued',
            'recipients': len(users),
            'email_sent': email_sent,
            'sms_sent': sms_sent,
            'push_sent': sent,
            'channels': sorted(channels),
        }, status=status.HTTP_200_OK)


class ReportAPIView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, report_type):
        payload = _generate_report_payload(report_type, request.query_params.get('start_date'), request.query_params.get('end_date'))
        if payload is None:
            payload = {'detail': 'Unsupported report type.'}

        if request.query_params.get('format') == 'csv':
            response = HttpResponse(_render_report_csv(report_type, payload), content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="{report_type}_report.csv"'
            return response
        return Response(payload, status=status.HTTP_200_OK)

    def post(self, request, report_type):
        email = request.data.get('email')
        if not email:
            return Response({'detail': 'Email address is required.'}, status=status.HTTP_400_BAD_REQUEST)

        payload = _generate_report_payload(report_type, request.data.get('start_date'), request.data.get('end_date'))
        if payload is None:
            return Response({'detail': 'Unsupported report type.'}, status=status.HTTP_400_BAD_REQUEST)

        frequency = request.data.get('frequency', 'daily')
        file_format = request.data.get('format')
        _send_report_message(email, report_type, payload, frequency=frequency, start_date=request.data.get('start_date'), end_date=request.data.get('end_date'), file_format=file_format)
        return Response({'message': 'Report email queued.'}, status=status.HTTP_200_OK)


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

            ensure_receipt_for_order(order)

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
        orders = Order.objects.select_related('customer__user').all().order_by('-created_at')
        data = []
        for order in orders:
            customer_name = f"{order.customer.user.first_name} {order.customer.user.last_name}".strip() or order.customer.user.email
            data.append({
                'id': order.id,
                'customer': customer_name,
                'customer_name': customer_name,
                'salon_name': order.customer.salon_name or '',
                'address': order.delivery_address or order.customer.address or '',
                'delivery_address': order.delivery_address or order.customer.address or '',
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
        ensure_receipt_for_order(order)
        _add_order_status_history(order, 'Confirmed', 'Order confirmed', 'Your order has been confirmed and is being prepared for dispatch.')
        subject, message = _build_order_status_message(order, 'Confirmed')
        _notify_user_preferred(order, subject, message)
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
        ensure_receipt_for_order(order)

        if order.order_status == 'Out for Delivery':
            delivery = getattr(order, 'delivery', None)
            if delivery:
                delivery.delivery_status = 'Out for Delivery'
                delivery.save(update_fields=['delivery_status'])
            _add_order_status_history(order, 'Out for Delivery', 'Out for delivery', 'Your order is on the way and a rider is heading to your address.')
            subject, message = _build_order_status_message(order, 'Out for Delivery')
            _notify_user_preferred(order, subject, message)
        elif order.order_status == 'Delivered':
            delivery = getattr(order, 'delivery', None)
            if delivery:
                delivery.delivery_status = 'Delivered'
                delivery.delivery_date = timezone.now()
                delivery.save(update_fields=['delivery_status', 'delivery_date'])
            _add_order_status_history(order, 'Delivered', 'Delivered', 'Your order has been delivered successfully.')
            subject, message = _build_order_status_message(order, 'Delivered')
            _notify_user_preferred(order, subject, message)
        else:
            _add_order_status_history(order, order.order_status, f"Status updated to {order.order_status}", f"Your order is now {order.order_status}.")
            subject, message = _build_order_status_message(order, order.order_status)
            _notify_user_preferred(order, subject, message)

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
        # Allow staff or admin/seller role users to generate receipts for any order
        user_role = str(getattr(request.user, 'role', '') or '').strip().lower()
        if not (getattr(request.user, 'is_staff', False) or user_role in {'admin', 'seller'} or order.customer.user == request.user):
            return Response({'detail': 'You do not have permission to generate a receipt.'}, status=status.HTTP_403_FORBIDDEN)

        receipt, created = ensure_receipt_for_order(order, request=request)

        # Ensure pdf_url is set to admin PDF endpoint if missing
        if not receipt.pdf_url:
            try:
                receipt.pdf_url = request.build_absolute_uri(f'/api/admin/receipts/{receipt.id}/pdf/')
                receipt.save(update_fields=['pdf_url'])
            except Exception:
                pass

        return Response({
            'id': receipt.id,
            'message': 'Receipt generated.' if created else 'Receipt already exists.',
            'receipt_number': receipt.receipt_number,
            'pdf_url': receipt.pdf_url,
        }, status=status.HTTP_200_OK)


class ReceiptPrintAPIView(APIView):
    permission_classes = [IsActiveUser]

    def get(self, request, receipt_id):
        receipt = Receipt.objects.select_related('order', 'order__customer__user').filter(pk=receipt_id).first()
        if not receipt:
            return Response({'detail': 'Receipt not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not request.user.is_staff and receipt.order.customer.user != request.user:
            return Response({'detail': 'You do not have permission to print this receipt.'}, status=status.HTTP_403_FORBIDDEN)

        return Response({'print_text': build_receipt_printer_payload(receipt)}, status=status.HTTP_200_OK)


class ReceiptDownloadAPIView(APIView):
    permission_classes = [IsActiveUser]

    def get(self, request, receipt_id):
        receipt = Receipt.objects.select_related('order', 'order__customer__user').filter(pk=receipt_id).first()
        if not receipt:
            return Response({'detail': 'Receipt not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not request.user.is_staff and receipt.order.customer.user != request.user:
            return Response({'detail': 'You do not have permission to download this receipt.'}, status=status.HTTP_403_FORBIDDEN)

        pdf_bytes = generate_receipt_pdf_bytes(receipt, request)
        buffer = BytesIO(pdf_bytes)
        response = FileResponse(buffer, as_attachment=True, filename=f"{receipt.receipt_number}.pdf")
        response['Content-Type'] = 'application/pdf'
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

        pdf_bytes = generate_receipt_pdf_bytes(receipt, request)
        filename = f"receipts/{receipt.receipt_number}.pdf"
        try:
            default_storage.save(filename, ContentFile(pdf_bytes))
            receipt.pdf_url = request.build_absolute_uri(default_storage.url(filename))
            receipt.save(update_fields=['pdf_url'])
        except Exception:
            receipt.pdf_url = request.build_absolute_uri(f'/api/admin/receipts/{receipt.id}/pdf/')

        context = build_receipt_context(receipt)
        cid_map, attachments = _fetch_inline_images_for_email(context['items'])
        for item in context['items']:
            image_url = item.get('image_url')
            if image_url and image_url in cid_map:
                item['image_cid'] = cid_map[image_url]

        try:
            html = render_to_string('email/receipt_email.html', context)
        except Exception:
            html = f"Please find attached receipt {receipt.receipt_number}."

        subject = f"Receipt {receipt.receipt_number}"
        email = EmailMessage(subject=subject, body=html, to=[to_email])
        email.content_subtype = 'html'
        # Do not set `mixed_subtype` — newer Django EmailMessage no longer supports this undocumented attribute.
        try:
            email.attach(f"{receipt.receipt_number}.pdf", pdf_bytes, 'application/pdf')
            for mime_image, _ in attachments:
                email.attach(mime_image)
            email.send(fail_silently=False)
        except Exception as e:
            return Response({'detail': 'Failed to send email.', 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({'message': 'Email sent.', 'pdf_url': receipt.pdf_url}, status=status.HTTP_200_OK)


class AdminReceiptPDFAPIView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, receipt_id):
        receipt = Receipt.objects.select_related('order', 'order__customer__user').filter(pk=receipt_id).first()
        if not receipt:
            return Response({'detail': 'Receipt not found.'}, status=status.HTTP_404_NOT_FOUND)

        pdf_bytes = generate_receipt_pdf_bytes(receipt, request)
        buffer = BytesIO(pdf_bytes)
        return FileResponse(buffer, as_attachment=True, filename=f"{receipt.receipt_number}.pdf")


def frontend_home(request):
    return render(request, 'frontend/home.html')


def download_android_app(request):
    """Send visitors to the current signed Android installer.

    Set ANDROID_APP_DOWNLOAD_URL on Railway after each successful EAS APK
    build. Keeping the URL in deployment settings lets the public homepage
    always send users to the latest release without another code change.
    """
    download_url = os.getenv(
        'ANDROID_APP_DOWNLOAD_URL',
        'https://expo.dev/artifacts/eas/Xhwp6f3IrjVi9j4YznXuEe70K23VqHfyNR4tQplwuxE.apk',
    )
    return redirect(download_url)


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

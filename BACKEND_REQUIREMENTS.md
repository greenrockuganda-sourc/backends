# Backend requirements contract

This document captures the backend API contract the frontend expects. The implementation is expected to cover the full admin and customer flows, not only auth and profile.

## Authentication and profile

- `POST /api/auth/register/`
- `POST /api/auth/login/`
- `POST /api/auth/logout/`
- `POST /api/auth/refresh/`
- `POST /api/auth/forgot-password/`
- `POST /api/auth/reset-password/`
- `GET /api/user/profile/`
- `PUT /api/user/profile/`

## Catalog and admin catalog CRUD

- `GET /api/categories/`
- `POST /api/categories/`
- `GET /api/categories/<id>/`
- `PUT /api/categories/<id>/`
- `DELETE /api/categories/<id>/`

- `GET /api/brands/`
- `POST /api/brands/`
- `GET /api/brands/<id>/`
- `PUT /api/brands/<id>/`
- `DELETE /api/brands/<id>/`

- `GET /api/products/`
- `POST /api/products/`
- `GET /api/products/<id>/`
- `PUT /api/products/<id>/`
- `DELETE /api/products/<id>/`

- `GET /api/products/search/`
- `GET /api/catalog/products/`

## Orders, delivery, and receipts

- `GET /api/orders/`
- `POST /api/orders/create/`
- `GET /api/orders/<id>/`
- `PATCH /api/orders/<id>/cancel/`
- `GET /api/orders/<id>/receipt/`
- `POST /api/orders/<id>/receipt/`

- `GET /api/admin/orders/`
- `GET /api/admin/orders/<id>/`
- `PATCH /api/admin/orders/<id>/confirm/`
- `PATCH /api/admin/orders/<id>/status/`
- `POST /api/admin/orders/<id>/status/create/`
- `PATCH /api/admin/orders/<id>/cancel/`
- `PATCH /api/admin/orders/<id>/payment/`

- `GET /api/admin/deliveries/`
- `GET /api/admin/deliveries/<id>/`
- `PATCH /api/admin/deliveries/<id>/`
- `POST /api/admin/deliveries/create/`

- `GET /api/admin/receipts/`
- `POST /api/admin/receipts/<id>/email/`
- `GET /api/admin/receipts/<id>/pdf/`

## Reports

- `GET /api/admin/reports/<reportType>/`
- `POST /api/admin/reports/<reportType>/`

Valid report types should include at least:

- `sales`
- `orders`
- `products`
- `customers`
- `categories`

## Notifications and broadcast flows

- `GET /api/admin/notifications/`
- `PATCH /api/admin/notifications/<id>/read/`
- `DELETE /api/admin/notifications/<id>/`
- `POST /api/admin/notifications/broadcast/`
- `POST /api/admin/notifications/broadcast-new-arrival/`
- `POST /api/notifications/register-token/`

## Admin dashboard and customer-facing integrations

- `GET /api/admin/dashboard/`
- `GET /api/admin/customers/`
- `GET /api/admin/inventory/`
- `GET /api/admin/payments/`
- `GET /api/admin/reviews/`
- `DELETE /api/admin/reviews/<id>/`
- `GET /api/search/`

## Notes

- Customer email delivery is only sent when a valid email is present.
- Status updates and delivery transitions must create underlying delivery records if missing to match the current frontend flow.
- Notification broadcasts should target customer users and support a `notification_type` field such as `new_arrival`.
- Admin report and receipt endpoints must return JSON responses for UI consumption and PDF/email actions for external actions.

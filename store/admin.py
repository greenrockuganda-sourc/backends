from django.contrib import admin

from .models import (
    Brand,
    CartItem,
    Category,
    Customer,
    Delivery,
    Notification,
    Order,
    OrderItem,
    Payment,
    Product,
    Receipt,
    Review,
    ShoppingCart,
    User,
)

admin.site.register(User)
admin.site.register(Customer)
admin.site.register(Category)
admin.site.register(Brand)
admin.site.register(Product)
admin.site.register(ShoppingCart)
admin.site.register(CartItem)
admin.site.register(Order)
admin.site.register(OrderItem)
admin.site.register(Payment)
admin.site.register(Delivery)
admin.site.register(Receipt)
admin.site.register(Notification)
admin.site.register(Review)

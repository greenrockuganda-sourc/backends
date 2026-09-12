from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model


class EmailOrPhoneBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        UserModel = get_user_model()
        identifier = kwargs.get('email') or kwargs.get('phone_number') or kwargs.get('email_or_phone') or username

        if not identifier or not password:
            return None

        user = UserModel.objects.filter(email__iexact=identifier).first()
        if not user:
            user = UserModel.objects.filter(phone_number=identifier).first()

        if user and self.user_can_authenticate(user) and user.check_password(password):
            return user

        return None

from rest_framework_simplejwt.authentication import JWTAuthentication


class CookieJWTAuthentication(JWTAuthentication):
    """Authentication class that looks for the access token in a secure HttpOnly cookie

    Falls back to the Authorization header when the cookie is not present to preserve
    compatibility with API clients that send the header.
    """

    def get_raw_token_from_cookie(self, request):
        return request.COOKIES.get('access')

    def authenticate(self, request):
        raw_token = self.get_raw_token_from_cookie(request)
        if raw_token is None:
            # Fallback to default behaviour (Authorization header)
            return super().authenticate(request)

        validated_token = self.get_validated_token(raw_token)
        user = self.get_user(validated_token)
        return (user, validated_token)

from django.urls import path, include 
from rest_framework.routers import DefaultRouter
from .views import RegisterView, MyConversationListView, MessageListCreateView, UploadAttachmentView, SearchUserView, StartDirectChatView, ContactViewSet
from .views import UserProfileView, NotificationViewSet

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from chat.views import CookieTokenObtainPairView, CookieTokenRefreshView, LogoutView

router = DefaultRouter()
router.register(r'contacts', ContactViewSet, basename='contact')
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    # Auth
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', CookieTokenObtainPairView.as_view(), name='token_obtain_pair'),
    
    # Đường dẫn thực tế sẽ là: /api/token/refresh/
    path('token/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh'),
    
    # Đường dẫn thực tế sẽ là: /api/logout/
    path('logout/', LogoutView.as_view(), name='logout'),

    # Chat
    path('conversations/', MyConversationListView.as_view(), name='my_conversations'),
    path('conversations/<uuid:conversation_id>/messages/', MessageListCreateView.as_view(), name='conversation_messages'),
    #upload file
    path('upload/', UploadAttachmentView.as_view(), name='upload_attachment'),
    
    #serch + add friends
    path('users/search/', SearchUserView.as_view(), name='search_users'),
    path('', include(router.urls)), # Bao gồm các route của contacts
    
    #begin chat
    path('conversations/start/', StartDirectChatView.as_view(), name='start_direct_chat'),
    
    #prifile
    path('users/me/', UserProfileView.as_view(), name='user_profile'),
]
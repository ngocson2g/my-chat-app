from django.urls import path, include 
from rest_framework.routers import DefaultRouter
from .views import RegisterView, MyConversationListView, MessageListCreateView, UploadAttachmentView, SearchUserView, StartDirectChatView, ContactViewSet
from .views import UserProfileView, NotificationViewSet, MarkAsReadView, MarkAsDeliveredView, SendOdooTaskView, OdooTaskWebhookView, OdooProcessTaskWebhookView, UpdateOdooProcessTaskStatusView

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
    
    # mark as read/delivered
    path('conversations/<uuid:conversation_id>/read/', MarkAsReadView.as_view(), name='mark_as_read'),
    path('messages/<uuid:message_id>/delivered/', MarkAsDeliveredView.as_view(), name='mark_as_delivered'),
    
    #prifile
    path('users/me/', UserProfileView.as_view(), name='user_profile'),
    
    # Odoo Integration
    path('conversations/<uuid:conversation_id>/tasks/send/', SendOdooTaskView.as_view(), name='send_odoo_task'),
    path('webhook/odoo-task-response/', OdooTaskWebhookView.as_view(), name='odoo_task_webhook'),
    path('webhook/odoo-process-task/', OdooProcessTaskWebhookView.as_view(), name='odoo_process_task_webhook'),
    path('process-tasks/<str:task_code>/update-status/', UpdateOdooProcessTaskStatusView.as_view(), name='update_odoo_process_task_status'),
]
from rest_framework import generics, permissions, status, viewsets
from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth import get_user_model
from .models import Conversation, Message, Attachment
from .serializers import UserSerializer, ConversationSerializer, MessageSerializer, ContactSerializer

from django.db.models import Q
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from .models import Contact, Participant
from django.db.models import Max, F
from .models import Notification
from .serializers import NotificationSerializer
from .services import MessageService

import redis
import json
from django.conf import settings

from .services import MessageService

#----
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import Conversation, Message, Attachment, Contact, Participant, Notification
from .serializers import (
    UserSerializer, ConversationSerializer, MessageSerializer, 
    ContactSerializer, NotificationSerializer
)

from rest_framework.exceptions import AuthenticationFailed

User = get_user_model()

# 1. API Đăng ký
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny] # Cho phép ai cũng được gọi API này

# 2. API Lấy danh sách cuộc trò chuyện của tôi
class MyConversationListView(generics.ListAPIView):
    serializer_class = ConversationSerializer

    def get_queryset(self):
        # Chỉ lấy những conversation mà user hiện tại đang tham gia
        return Conversation.objects.filter(participants=self.request.user)

# 3. API Gửi tin nhắn & Lấy tin nhắn trong 1 cuộc hội thoại
class MessageListCreateView(generics.ListCreateAPIView):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated] # Đảm bảo user đã login

    def get_queryset(self):
        # Lấy conversation_id từ URL
        conversation_id = self.kwargs['conversation_id']
        
        # Kiểm tra xem user có quyền xem conversation này không (nếu cần bảo mật)
        # return Message.objects.filter(conversation_id=conversation_id, conversation__participants=self.request.user)...
        
        return Message.objects.filter(conversation_id=conversation_id).order_by('created_at')

    def perform_create(self, serializer):
        conversation_id = self.kwargs['conversation_id']
        
        # Tối ưu: Dùng get_object_or_404 để trả về 404 nếu không tìm thấy ID
        conversation = get_object_or_404(Conversation, pk=conversation_id)
        
        # 1. Lưu vào PostgreSQL
        # serializer.save() trả về instance của model Message vừa tạo
        instance = serializer.save(sender=self.request.user, conversation=conversation)

        # 2. Gọi Service xử lý logic realtime/nghiệp vụ
        service = MessageService()
        service.send_message(instance)
        

#upload file 
class UploadAttachmentView(APIView):
    parser_classes = (MultiPartParser, FormParser) # Để xử lý form-data (file)

    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({"error": "No file uploaded"}, status=400)
        
        # Tạo bản ghi Attachment (chưa gắn message_id)
        attachment = Attachment.objects.create(file=file_obj)
        
        return Response({
            "status": "success",
            "file_url": attachment.file.url,
            "attachment_id": attachment.attachment_id,
            "file_type": file_obj.content_type
        }, status=201)
        
# --- API 1: Tìm kiếm User ---
class SearchUserView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get_queryset(self):
        query = self.request.query_params.get('q', '')
        if not query:
            return User.objects.none()
        
        # Tìm theo username hoặc display_name, loại trừ chính mình
        return User.objects.filter(
            Q(username__icontains=query) | Q(display_name__icontains=query)
        ).exclude(id=self.request.user.id)[:20] # Giới hạn 20 kết quả
        
# --- API 2: Quản lý Bạn bè (Contact) ---
class ContactViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ContactSerializer

    def get_queryset(self):
        # Lấy danh sách những người liên quan đến mình (kể cả pending hay accepted)
        return Contact.objects.filter(
            Q(user_from=self.request.user) | Q(user_to=self.request.user)
        )

    # Action: Gửi lời mời kết bạn
    @action(detail=False, methods=['post'])
    def send_request(self, request):
        target_username = request.data.get('username')
        if not target_username:
            return Response({"error": "Thiếu username"}, status=400)
            
        try:
            target_user = User.objects.get(username=target_username)
        except User.DoesNotExist:
            return Response({"error": "User không tồn tại"}, status=404)

        if target_user == request.user:
            return Response({"error": "Không thể kết bạn với chính mình"}, status=400)

        # Kiểm tra xem đã có quan hệ chưa
        existing = Contact.objects.filter(
            (Q(user_from=request.user) & Q(user_to=target_user)) |
            (Q(user_from=target_user) & Q(user_to=request.user))
        ).first()

        if existing:
            return Response({"error": f"Đã tồn tại trạng thái: {existing.status}"}, status=400)

        # Tạo lời mời mới
        contact = Contact.objects.create(user_from=request.user, user_to=target_user, status='pending')
        return Response(ContactSerializer(contact).data, status=201)

    # Action: Chấp nhận lời mời
    @action(detail=True, methods=['post'])
    def accept_request(self, request, pk=None):
        try:
            contact = Contact.objects.get(pk=pk, user_to=request.user, status='pending')
        except Contact.DoesNotExist:
            return Response({"error": "Lời mời không hợp lệ hoặc không tồn tại"}, status=404)

        # 1. Cập nhật trạng thái thành Accepted
        contact.status = 'accepted'
        contact.save()

        # 2. LOGIC TỰ ĐỘNG TẠO CONVERSATION
        user1 = contact.user_from
        user2 = contact.user_to

        # Kiểm tra xem 2 người này đã có đoạn chat chung nào chưa (loại trừ chat nhóm)
        # Đây là logic đơn giản, kiểm tra chat 1-1
        existing_conversations = Conversation.objects.filter(
            participants__user=user1, type='individual'
        ).filter(
            participants__user=user2
        ).distinct()

        if not existing_conversations.exists():
            # Tạo Conversation mới
            new_conv = Conversation.objects.create(type='individual')
            Participant.objects.create(conversation=new_conv, user=user1)
            Participant.objects.create(conversation=new_conv, user=user2)
            print(f"Đã tự động tạo chat giữa {user1.username} và {user2.username}")

        return Response({"status": "accepted", "contact_id": contact.id})
    
    
#bat dau hoi thoai
class StartDirectChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            target_username = request.data.get('username')
            if not target_username:
                return Response({"error": "Thiếu username"}, status=400)

            User = get_user_model()
            try:
                target_user = User.objects.get(username=target_username)
            except User.DoesNotExist:
                return Response({"error": "User không tồn tại"}, status=404)

            if target_user == request.user:
                return Response({"error": "Không thể chat với chính mình"}, status=400)

            
            # 1. Lấy danh sách ID các cuộc trò chuyện mà TÔI tham gia
            my_conv_ids = Participant.objects.filter(
                user=request.user
            ).values_list('conversation_id', flat=True)

            # 2. Lấy danh sách ID các cuộc trò chuyện mà ĐỐI PHƯƠNG tham gia
            target_conv_ids = Participant.objects.filter(
                user=target_user
            ).values_list('conversation_id', flat=True)

            # 3. Tìm giao điểm (ID chung) -> Đây chính là đoạn chat giữa 2 người
            common_ids = set(my_conv_ids).intersection(set(target_conv_ids))
            
            # 4. Kiểm tra trong các ID chung, cái nào là loại 'individual'
            direct_conv = Conversation.objects.filter(
                conversation_id__in=common_ids,
                type='individual'
            ).first()

            if direct_conv:
                return Response({"conversation_id": direct_conv.conversation_id}, status=200)

            # --- NẾU CHƯA CÓ THÌ TẠO MỚI ---
            
            # Tạo Conversation
            new_conv = Conversation.objects.create(type='individual')
            
            # Tạo Participant (Người tham gia)
            Participant.objects.create(conversation=new_conv, user=request.user)
            Participant.objects.create(conversation=new_conv, user=target_user)

            return Response({"conversation_id": new_conv.conversation_id}, status=201)

        except Exception as e:
            print(f"LỖI SERVER CHI TIẾT: {str(e)}")
            return Response({"error": "Lỗi xử lý server"}, status=500)
        
        
class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    # Lấy thông tin cá nhân
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    # Cập nhật thông tin cá nhân (Avatar, Display Name...)
    def put(self, request):
        user = request.user
        serializer = UserSerializer(user, data=request.data, partial=True) # partial=True để update từng phần
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)


    
class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    # API đánh dấu đã đọc
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.is_read = True
        notif.save()
        return Response({'status': 'marked as read'})
    
    
#----
class CookieTokenObtainPairView(TokenObtainPairView):
    """Đăng nhập: Trả về Access Token JSON và Set Refresh Token vào Cookie"""
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            refresh_token = response.data.get('refresh')
            # Xóa refresh khỏi body trả về để bảo mật
            if 'refresh' in response.data:
                del response.data['refresh']
            
            # Set Cookie
            response.set_cookie(
                key='refresh_token',
                value=refresh_token,
                httponly=True,  # JS không đọc được
                secure=False,   # Đặt True nếu chạy HTTPS
                samesite='Lax',
                max_age=7 * 24 * 60 * 60
            )
        return response

class CookieTokenRefreshView(TokenRefreshView):
    def get_serializer(self, *args, **kwargs):
        data = self.request.data.copy()
        
        # Nếu client không gửi body refresh, tìm trong cookie
        if 'refresh' not in data:
            data['refresh'] = self.request.COOKIES.get('refresh_token')

        # --- SỬA LỖI TẠI ĐÂY ---
        # Nếu vẫn không có token (data['refresh'] là None hoặc rỗng)
        # Báo lỗi ngay lập tức để không chạy vào validator của Serializer
        if not data.get('refresh'):
            raise AuthenticationFailed("No refresh token found in cookie")
            
        kwargs['data'] = data
        return super().get_serializer(*args, **kwargs)

    def post(self, request, *args, **kwargs):
        try:
            response = super().post(request, *args, **kwargs)
        except Exception as e:
            # Chỉ in ra log debug, không cần làm gì thêm vì Frontend sẽ tự handle 401
            # print(f"Refresh Failed: {str(e)}") 
            res = Response({"error": "Invalid refresh token"}, status=401)
            res.delete_cookie('refresh_token')
            return res

        if response.status_code == 200 and 'refresh' in response.data:
            refresh_token = response.data['refresh']
            del response.data['refresh']
            response.set_cookie(
                key='refresh_token',
                value=refresh_token,
                httponly=True,
                secure=False,
                samesite='Lax',
                max_age=7 * 24 * 60 * 60
            )
        return response
    
class LogoutView(APIView):
    """Đăng xuất: Xóa Cookie"""
    def post(self, request):
        response = Response({"message": "Logged out successfully"}, status=200)
        response.delete_cookie('refresh_token')
        return response
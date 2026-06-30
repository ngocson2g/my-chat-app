from rest_framework import generics, permissions, status, viewsets
from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth import get_user_model
from django.utils import timezone
import uuid
import requests
import threading
from .models import Conversation, Message, Attachment, ExternalTask, ExternalProcessTask
from .serializers import UserSerializer, ConversationSerializer, MessageSerializer, ContactSerializer, ExternalTaskSerializer

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
        return Message.objects.filter(conversation_id=conversation_id).order_by('created_at')

    def list(self, request, *args, **kwargs):
        conversation_id = self.kwargs['conversation_id']
        page = request.query_params.get('page', '1')

        redis_client = redis.StrictRedis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0)
        cache_key = f"room_messages:{conversation_id}"

        # 1. Nếu là trang đầu tiên, ưu tiên đọc từ Redis Cache
        if str(page) == '1':
            try:
                # Lấy 50 tin nhắn gần nhất từ Redis Sorted Set
                cached_msgs = redis_client.zrange(cache_key, 0, -1)
                if cached_msgs:
                    messages_data = [json.loads(msg.decode('utf-8')) for msg in cached_msgs]
                    return Response({
                        "count": len(messages_data),
                        "next": None,  # Hoặc URL trang 2
                        "previous": None,
                        "results": messages_data,
                        "source": "redis_cache" # Đánh dấu để dễ debug
                    })
            except Exception as e:
                print(f"Redis Cache Error: {e}")

        # 2. Nếu Cache Miss (Hoặc tải trang 2, 3...), lấy từ DB
        response = super().list(request, *args, **kwargs)

        # 3. Lưu ngược vào Redis (Nếu là trang 1 và Cache bị trống)
        if str(page) == '1' and response.status_code == 200:
            try:
                # Chỉ lấy tối đa 50 tin
                messages = response.data.get('results', response.data)[:50]
                if messages:
                    # Xoá cache cũ
                    redis_client.delete(cache_key)
                    # Thêm lại 50 tin vào ZSET
                    for msg in messages:
                        import dateutil.parser
                        score = dateutil.parser.isoparse(msg['created_at']).timestamp()
                        redis_client.zadd(cache_key, {json.dumps(msg): score})
            except Exception as e:
                print(f"Redis Cache Save Error: {e}")

        return response

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
            participants__user=user1, type='private'
        ).filter(
            participants__user=user2
        ).distinct()

        if not existing_conversations.exists():
            # Tạo Conversation mới
            new_conv = Conversation.objects.create(type='private')
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
                type='private'
            ).first()

            if direct_conv:
                return Response({"conversation_id": direct_conv.conversation_id}, status=200)

            # --- NẾU CHƯA CÓ THÌ TẠO MỚI ---
            
            # Tạo Conversation
            new_conv = Conversation.objects.create(type='private')
            
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

class MarkAsReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, conversation_id):
        # 1. Update last_read_message for this user in this conversation
        conversation = get_object_or_404(Conversation, pk=conversation_id)
        participant = get_object_or_404(Participant, conversation=conversation, user=request.user)
        
        last_message = Message.objects.filter(conversation=conversation).order_by('-created_at').first()
        if last_message:
            participant.last_read_message = last_message
            participant.save()
            
            # 2. Update status='read' for all messages in this conversation sent by OTHER users
            # (only those that are not already read)
            messages_to_update = Message.objects.filter(
                conversation=conversation, 
                created_at__lte=timezone.now()
            ).exclude(sender=request.user).exclude(status='read')
            
            if messages_to_update.exists():
                messages_to_update.update(status='read')
                
                # 3. Cập nhật vào Redis Cache để đồng bộ
                redis_client = redis.StrictRedis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0)
                cache_key = f"room_messages:{conversation_id}"
                
                # Lấy tất cả tin nhắn trong cache
                try:
                    cached_msgs = redis_client.zrange(cache_key, 0, -1)
                    if cached_msgs:
                        redis_client.delete(cache_key) # Xoá cache cũ
                        for msg_bytes in cached_msgs:
                            msg_dict = json.loads(msg_bytes.decode('utf-8'))
                            # Cập nhật status trong cache
                            if msg_dict.get('sender') != request.user.username and msg_dict.get('status') != 'read':
                                msg_dict['status'] = 'read'
                            
                            import dateutil.parser
                            score = dateutil.parser.isoparse(msg_dict['created_at']).timestamp()
                            redis_client.zadd(cache_key, {json.dumps(msg_dict): score})
                except Exception as e:
                    print(f"Error updating cache for MarkAsRead: {e}")

                # 4. Broadcast to other participants via Redis Pub/Sub
                other_participants = Participant.objects.filter(conversation=conversation).exclude(user=request.user)
                for other in other_participants:
                    payload = {
                        "target_user_id": str(other.user.username),
                        "data": {
                            "type": "read_receipt",
                            "conversation_id": str(conversation_id),
                            "read_by": str(request.user.username),
                        }
                    }
                    redis_client.publish('chat_global', json.dumps(payload))
                
        return Response({"status": "success"})

class MarkAsDeliveredView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, message_id):
        message = get_object_or_404(Message, pk=message_id)
        
        # Chỉ đánh dấu đã nhận nếu tin nhắn đang ở trạng thái 'sent' và không phải của chính mình gửi
        if message.status == 'sent' and message.sender != request.user:
            message.status = 'delivered'
            message.save()
            
            # Cập nhật cache Redis
            redis_client = redis.StrictRedis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0)
            cache_key = f"room_messages:{message.conversation.conversation_id}"
            try:
                cached_msgs = redis_client.zrange(cache_key, 0, -1)
                if cached_msgs:
                    redis_client.delete(cache_key)
                    for msg_bytes in cached_msgs:
                        msg_dict = json.loads(msg_bytes.decode('utf-8'))
                        if msg_dict.get('message_id') == str(message_id):
                            msg_dict['status'] = 'delivered'
                        
                        import dateutil.parser
                        score = dateutil.parser.isoparse(msg_dict['created_at']).timestamp()
                        redis_client.zadd(cache_key, {json.dumps(msg_dict): score})
            except Exception as e:
                print(f"Error updating cache for MarkAsDelivered: {e}")

            # Broadcast sự kiện về cho người gửi
            payload = {
                "target_user_id": str(message.sender.username),
                "data": {
                    "type": "delivered_receipt",
                    "message_id": str(message_id),
                    "conversation_id": str(message.conversation.conversation_id),
                }
            }
            redis_client.publish('chat_global', json.dumps(payload))
            
        return Response({"status": "success"})


# ── TÍCH HỢP ODOO: GỬI TASK VÀ NHẬN WEBHOOK ───────────────────────────

def refresh_conversation_redis_cache(conversation_id):
    try:
        from .utils import RedisClient
        from .serializers import MessageSerializer
        redis_client = RedisClient.get_client()
        cache_key = f"room_messages:{conversation_id}"
        
        messages = Message.objects.filter(conversation_id=conversation_id).order_by('created_at')[:50]
        if messages:
            redis_client.delete(cache_key)
            for msg in messages:
                serializer = MessageSerializer(msg)
                msg_data = serializer.data
                score = msg.created_at.timestamp()
                redis_client.zadd(cache_key, {json.dumps(msg_data, default=str): score})
    except Exception as e:
        print(f"Lỗi khi refresh cache Redis: {e}")


class SendOdooTaskView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, conversation_id):
        conversation = get_object_or_404(Conversation, pk=conversation_id)
        
        if not Participant.objects.filter(conversation=conversation, user=request.user).exists():
            return Response({"error": "Bạn không tham gia cuộc hội thoại này"}, status=403)
            
        title = request.data.get('title')
        message_content = request.data.get('message')
        target_user = request.data.get('target_user')
        
        if not title or not message_content or not target_user:
            return Response({"error": "Thiếu thông tin title, message hoặc target_user"}, status=400)
            
        task_code = f"TASK-{uuid.uuid4().hex[:8].upper()}"
        
        message = Message.objects.create(
            conversation=conversation,
            sender=request.user,
            content=f"Yêu cầu nhiệm vụ: {title}",
            message_type='external_task'
        )
        
        external_task = ExternalTask.objects.create(
            message=message,
            task_code=task_code,
            title=title,
            description=message_content,
            target_odoo_user=target_user,
            status='pending'
        )
        
        # Gọi API sang Odoo (Background)
        def send_to_odoo_async():
            try:
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': f"Bearer {settings.ODOO_API_TOKEN}"
                }
                payload = {
                    "jsonrpc": "2.0",
                    "method": "call",
                    "params": {
                        "target_user": target_user,
                        "title": title,
                        "message": message_content,
                        "task_code": task_code
                    }
                }
                url = f"{settings.ODOO_API_URL}/api/v1/popup/trigger"
                resp = requests.post(url, json=payload, headers=headers, timeout=10)
                if resp.status_code != 200:
                    print(f"Odoo trigger failed: HTTP {resp.status_code} — {resp.text}")
                    external_task.status = 'failed'
                    external_task.save()
                    refresh_conversation_redis_cache(conversation.conversation_id)
            except Exception as e:
                print(f"Error calling Odoo: {e}")
                external_task.status = 'failed'
                external_task.save()
                refresh_conversation_redis_cache(conversation.conversation_id)
                
        threading.Thread(target=send_to_odoo_async, daemon=True).start()
        
        # Cập nhật cache
        refresh_conversation_redis_cache(conversation.conversation_id)
        
        # Broadcast event new_message sang WebSocket
        from .utils import RedisClient
        redis_client = RedisClient.get_client()
        participants = conversation.participants.all()
        message_data = MessageSerializer(message).data
        message_data['type'] = 'new_message'
        
        for participant in participants:
            ws_payload = {
                "target_user_id": str(participant.username),
                "data": message_data
            }
            redis_client.publish('chat_global', json.dumps(ws_payload, default=str))
            
        return Response(MessageSerializer(message).data, status=201)


class OdooTaskWebhookView(APIView):
    permission_classes = [] # Public, auth by Bearer token in headers
    authentication_classes = []
    
    def post(self, request):
        auth_header = request.headers.get('Authorization')
        expected_token = f"Bearer {settings.ODOO_WEBHOOK_TOKEN}"
        if not auth_header or auth_header != expected_token:
            return Response({"error": "Authentication failed!"}, status=401)
            
        task_code = request.data.get('task_code')
        user = request.data.get('user')
        response_text = request.data.get('response')
        responded_at_str = request.data.get('responded_at')
        
        if not task_code or not response_text:
            return Response({"error": "Missing task_code or response"}, status=400)
            
        external_task = ExternalTask.objects.filter(task_code=task_code).first()
        if not external_task:
            return Response({"error": f"Task not found: {task_code}"}, status=404)
            
        from django.utils import timezone
        from django.utils.dateparse import parse_datetime
        
        try:
            responded_at = parse_datetime(responded_at_str)
            if not responded_at:
                responded_at = timezone.now()
        except Exception:
            responded_at = timezone.now()
            
        external_task.status = 'responded'
        external_task.response_content = response_text
        external_task.responded_by = user
        external_task.responded_at = responded_at
        external_task.save()
        
        message = external_task.message
        conversation = message.conversation
        refresh_conversation_redis_cache(conversation.conversation_id)
        
        from .utils import RedisClient
        redis_client = RedisClient.get_client()
        participants = conversation.participants.all()
        
        message_data = MessageSerializer(message).data
        message_data['type'] = 'task_update'
        
        for participant in participants:
            ws_payload = {
                "target_user_id": str(participant.username),
                "data": message_data
            }
            redis_client.publish('chat_global', json.dumps(ws_payload, default=str))
            
        return Response({"status": "success", "message": f"Task {task_code} updated successfully"})


class OdooProcessTaskWebhookView(APIView):
    permission_classes = []
    authentication_classes = []
    
    def post(self, request):
        auth_header = request.headers.get('Authorization')
        expected_token = f"Bearer {settings.ODOO_TASK_MANAGER_WEBHOOK_TOKEN}"
        if not auth_header or auth_header != expected_token:
            return Response({"error": "Authentication failed!"}, status=401)
            
        task_code = request.data.get('task_code')
        task_name = request.data.get('task_name')
        description = request.data.get('description')
        
        if not task_code or not task_name:
            return Response({"error": "Missing task_code or task_name"}, status=400)
            
        conversation_id = request.query_params.get('conversation_id')
        if not conversation_id:
            first_conv = Conversation.objects.first()
            if not first_conv:
                return Response({"error": "No conversations exist in the system"}, status=400)
            conversation_id = str(first_conv.conversation_id)
            
        conversation = get_object_or_404(Conversation, pk=conversation_id)
        
        external_process_task = ExternalProcessTask.objects.filter(task_code=task_code).first()
        
        is_new = False
        if external_process_task:
            external_process_task.name = task_name
            external_process_task.description = description
            external_process_task.save()
            
            message = external_process_task.message
            message.content = f"Nhiệm vụ Odoo cập nhật: {task_name}"
            message.save()
        else:
            is_new = True
            system_user = User.objects.filter(is_superuser=True).first()
            if not system_user:
                system_user = User.objects.first()
                
            message = Message.objects.create(
                conversation=conversation,
                sender=system_user,
                content=f"Nhiệm vụ Odoo mới: {task_name}",
                message_type='external_process_task'
            )
            
            external_process_task = ExternalProcessTask.objects.create(
                message=message,
                task_code=task_code,
                name=task_name,
                description=description,
                status='sent'
            )
            
        refresh_conversation_redis_cache(conversation.conversation_id)
        
        from .utils import RedisClient
        redis_client = RedisClient.get_client()
        participants = conversation.participants.all()
        
        message_data = MessageSerializer(message).data
        message_data['type'] = 'new_message' if is_new else 'process_task_update'
        
        for participant in participants:
            ws_payload = {
                "target_user_id": str(participant.username),
                "data": message_data
            }
            redis_client.publish('chat_global', json.dumps(ws_payload, default=str))
            
        return Response({"status": "success", "message": f"Task {task_code} synced successfully"})


class UpdateOdooProcessTaskStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, task_code):
        new_status = request.data.get('status')
        if not new_status:
            return Response({"error": "Missing status parameter"}, status=400)
            
        external_process_task = get_object_or_404(ExternalProcessTask, task_code=task_code)
        
        message = external_process_task.message
        conversation = message.conversation
        if not Participant.objects.filter(conversation=conversation, user=request.user).exists():
            return Response({"error": "Bạn không có quyền cập nhật task này"}, status=403)
            
        try:
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f"Bearer {settings.ODOO_TASK_MANAGER_API_TOKEN}"
            }
            payload = {
                "jsonrpc": "2.0",
                "method": "call",
                "params": {
                    "task_code": task_code,
                    "new_status": new_status
                }
            }
            url = f"{settings.ODOO_API_URL}/api/v1/task/update_status"
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            if resp.status_code != 200:
                print(f"Odoo trigger failed: HTTP {resp.status_code} — {resp.text}")
                return Response({"error": "Cập nhật trên Odoo thất bại!"}, status=500)
                
            resp_data = resp.json()
            if resp_data.get('result', {}).get('status') == 'error':
                 return Response({"error": resp_data['result'].get('message')}, status=400)
                 
        except Exception as e:
            print(f"Error calling Odoo: {e}")
            return Response({"error": "Lỗi kết nối tới Odoo"}, status=500)
            
        external_process_task.status = new_status
        external_process_task.save()
        
        refresh_conversation_redis_cache(conversation.conversation_id)
        
        from .utils import RedisClient
        redis_client = RedisClient.get_client()
        participants = conversation.participants.all()
        
        message_data = MessageSerializer(message).data
        message_data['type'] = 'process_task_update'
        
        for participant in participants:
            ws_payload = {
                "target_user_id": str(participant.username),
                "data": message_data
            }
            redis_client.publish('chat_global', json.dumps(ws_payload, default=str))
            
        return Response({"status": "success", "message": f"Task {task_code} updated to {new_status}"})
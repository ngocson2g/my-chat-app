from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Conversation, Message, Participant, Attachment, Contact, Device, ExternalTask, ExternalProcessTask
from .models import Notification

User = get_user_model()

# Tạo Serializer cho Attachment
class AttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attachment
        fields = ['attachment_id', 'file', 'file_type', 'file_size']

# 1. Serializer cho User (Đăng ký & Hiển thị)
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'password', 'display_name', 'phone_number']
        extra_kwargs = {'password': {'write_only': True}} # Không trả về password khi get info

    def create(self, validated_data):
        # Hash password khi tạo user
        user = User.objects.create_user(**validated_data)
        return user

class ExternalTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExternalTask
        fields = [
            'task_code', 'title', 'description', 'target_odoo_user',
            'status', 'response_content', 'responded_by', 'responded_at', 'created_at'
        ]

class ExternalProcessTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExternalProcessTask
        fields = [
            'task_code', 'name', 'description', 'status', 'created_at', 'updated_at'
        ]

# 2. Serializer cho Tin nhắn
class MessageSerializer(serializers.ModelSerializer):
    #sender_name = serializers.ReadOnlyField(source='sender.display_name')

    sender = serializers.SlugRelatedField(slug_field='username', read_only=True)
    attachments = AttachmentSerializer(many=True, read_only=True)
    external_task = ExternalTaskSerializer(read_only=True)
    external_process_task = ExternalProcessTaskSerializer(read_only=True)
    class Meta:
        model = Message
        fields = ['message_id', 'conversation', 'sender', 'content', 'message_type', 'status', 'created_at', 'attachments', 'external_task', 'external_process_task']
        read_only_fields = ['sender', 'message_id', 'created_at', 'conversation']

# 3. Serializer cho Hội thoại
class ConversationSerializer(serializers.ModelSerializer):
    last_message = serializers.SerializerMethodField()
    conversation_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Conversation
        # Nhớ thêm 'last_message' vào fields để Frontend nhận được dữ liệu
        fields = ['conversation_id', 'conversation_name', 'type', 'created_at', 'last_message']
        
    def get_conversation_name(self, obj):
        request = self.context.get('request')
        
        # Nếu là chat nhóm -> Trả về tên nhóm
        if obj.type == 'group':
            return obj.conversation_name
        
        # Nếu là chat cá nhân -> Trả về tên người kia
        if request and request.user:
            # --- SỬA LỖI TẠI ĐÂY ---
            # obj.participants trả về danh sách User.
            # Ta lọc theo 'id' để loại bỏ chính mình.
            other_user = obj.participants.exclude(id=request.user.id).first()
            
            if other_user:
                return other_user.username
                
        return "Unknown"

    def get_last_message(self, obj):
        # Lấy tin nhắn mới nhất
        last_msg = obj.messages.order_by('-created_at').first()
        if last_msg:
            return {
                "content": last_msg.content,
                "created_at": last_msg.created_at,
                "sender": last_msg.sender.username,
                "message_type": last_msg.message_type
            }
        return None
        
        
# --- 5. Contact Serializer (Bạn bè) ---
class ContactSerializer(serializers.ModelSerializer):
    # Hiển thị tên người gửi/nhận thay vì ID
    user_from = serializers.SlugRelatedField(slug_field='username', read_only=True)
    
    # Với user_to, ta cần queryset để validate khi gửi lời mời kết bạn (Writeable)
    user_to = serializers.SlugRelatedField(slug_field='username', queryset=User.objects.all())

    class Meta:
        model = Contact
        fields = ['id', 'user_from', 'user_to', 'status', 'created_at']


# --- 6. Device Serializer (Push Notification) ---
class DeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = ['device_id', 'fcm_token', 'os_type', 'last_used']
        read_only_fields = ['last_used']
        
# notification 
class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'
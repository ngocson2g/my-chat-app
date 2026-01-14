# chat/services.py
import json
from django.conf import settings
from .utils import RedisClient

class MessageService:
    def __init__(self):
        self.redis = RedisClient.get_client()

    def send_message(self, message_instance):
        """Xử lý logic gửi tin nhắn sau khi đã lưu DB"""
        conversation_id = str(message_instance.conversation.conversation_id)
        
        # 1. Chuẩn bị payload
        payload = {
            "type": "new_message",
            "message_id": str(message_instance.message_id),
            "content": message_instance.content,
            "sender": message_instance.sender.username,
            "conversation_id": conversation_id,
            "created_at": message_instance.created_at.isoformat()
        }

        # 2. Bắn sang Redis (Rust sẽ nhận)
        channel_name = f"chat_{conversation_id}"
        self.redis.publish(channel_name, json.dumps(payload))
        
        # 3. Logic thông báo (Notification) nếu cần
        # self.notification_service.create_notification(...)
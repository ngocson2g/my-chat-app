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

        # 2. Bắn sang Redis (Rust sẽ nhận qua kênh chat_global)
        # BỎ QUA - Đã được xử lý bởi post_save signal trong chat/signals.py
        # participants = message_instance.conversation.participants.all()
        # for p in participants:
        #     redis_payload = {
        #         "target_user_id": p.username,
        #         "data": payload
        #     }
        #     self.redis.publish("chat_global", json.dumps(redis_payload))
        
        # 3. Logic thông báo (Notification) nếu cần
        # self.notification_service.create_notification(...)
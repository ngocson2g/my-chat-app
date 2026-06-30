# chat/signals.py
import json
import redis
from django.db.models.signals import post_save
from django.dispatch import receiver
# NHỚ IMPORT MODEL NOTIFICATION
from .models import Message, Notification, Contact

# Kết nối Redis (Mặc định port 6379)
from .utils import RedisClient
redis_client = RedisClient.get_client()

@receiver(post_save, sender=Message)
def send_message_to_redis(sender, instance, created, **kwargs):
    if created:
        if instance.message_type in ['external_task', 'external_process_task']:
            return
        conversation = instance.conversation
        participants = conversation.participants.all()

        
        conversation.last_message_at = instance.created_at
        conversation.save(update_fields=['last_message_at'])
        
        # Chuẩn bị dữ liệu gửi đi (Payload cho Chat Realtime)
        # Sửa cấu trúc giống với Serializer để dùng được cho cả Cache và Socket
        message_data = {
            "type": "new_message",
            "message_id": str(instance.message_id),
            "conversation": str(conversation.conversation_id),
            "content": instance.content,
            "sender": instance.sender.username,
            "created_at": instance.created_at.isoformat(),
            "preview": instance.content[:30] + "..." if len(instance.content) > 30 else instance.content,
            "message_type": instance.message_type,
            "attachments": [] # Để đơn giản cho cache realtime (có thể serialize thực nếu cần)
        }
        
        # --- LƯU CACHE LÊN REDIS CHO TỐI ƯU HIỆU NĂNG ---
        try:
            cache_key = f"room_messages:{conversation.conversation_id}"
            score = instance.created_at.timestamp()
            
            # Thêm tin nhắn mới vào ZSET
            # Tạo copy payload bỏ trường "type" đi (vì API không cần trường này)
            cache_payload = message_data.copy()
            del cache_payload["type"]
            del cache_payload["preview"]
            
            redis_client.zadd(cache_key, {json.dumps(cache_payload): score})
            
            # Giữ lại tối đa 50 tin nhắn mới nhất
            # Nghĩa là xoá từ tin đầu tiên (cũ nhất) đến tin thứ 51 từ cuối lên
            redis_client.zremrangebyrank(cache_key, 0, -51)
        except Exception as e:
            print(f"Lỗi khi push Redis Cache: {e}")
        # -----------------------------------------------

        # Duyệt qua tất cả người nhận
        for participant in participants:
            # ---------------------------------------------------------
            # 1. LƯU THÔNG BÁO VÀO DATABASE (Logic Mới)
            # Chỉ tạo thông báo cho người nhận (không tạo cho chính người gửi)
            if participant.username != instance.sender.username:
                try:
                    notif_content = f"{instance.sender.username} đã gửi tin nhắn mới"
                    
                    # Lấy content an toàn (nếu None thì coi là chuỗi rỗng)
                    safe_content = instance.content or "" 

                    if safe_content.startswith("IMAGE:"):
                        notif_content = f"{instance.sender.username} đã gửi một ảnh"
                    elif safe_content.startswith("FILE:"):
                        notif_content = f"{instance.sender.username} đã gửi một tệp tin"
                    # Nếu muốn check theo message_type (chuẩn hơn)
                    elif instance.message_type == 'image':
                        notif_content = f"{instance.sender.username} đã gửi một ảnh"

                    Notification.objects.create(
                        user=participant,
                        notification_type='message',
                        content=notif_content,
                        related_id=str(conversation.conversation_id)
                    )
                except Exception as e:
                    print(f"Lỗi khi lưu notification: {e}")

            # ---------------------------------------------------------
            # 2. GỬI REDIS CHO RUST (Logic Cũ - Giữ nguyên)
            # Gửi socket cho tất cả (kể cả người gửi để update UI chat)
            
            payload = {
                "target_user_id": str(participant.username), # Dùng username làm ID định danh socket
                "data": message_data
            }

            # PUBLISH vào kênh chung "chat_global"
            redis_client.publish('chat_global', json.dumps(payload))
            
            
@receiver(post_save, sender=Contact)
def send_contact_notification(sender, instance, created, **kwargs):
    # Chỉ xử lý khi vừa tạo mới (Gửi lời mời) hoặc khi Accept
    if created:
        # Trường hợp 1: A gửi lời mời cho B (status='pending')
        if instance.status == 'pending':
            target_user = instance.user_to # Người nhận lời mời
            content = f"{instance.user_from.username} đã gửi lời mời kết bạn."
            type_socket = "friend_request"
            
            # 1. Tạo Notification DB
            Notification.objects.create(
                user=target_user,
                notification_type='friend_request',
                content=content,
                related_id=str(instance.user_from.id)
            )

            # 2. Gửi Redis
            payload = {
                "target_user_id": str(target_user.username),
                "data": {
                    "type": type_socket, # <--- Frontend sẽ check cái này
                    "sender": instance.user_from.username,
                    "content": content,
                    "created_at": instance.created_at.isoformat()
                }
            }
            redis_client.publish('chat_global', json.dumps(payload))
            
    else:
        # Trường hợp 2: B chấp nhận lời mời (status='accepted')
        # instance.user_to là người vừa bấm Accept
        if instance.status == 'accepted':
             # Gửi thông báo lại cho người xin (user_from)
            target_user = instance.user_from 
            content = f"{instance.user_to.username} đã chấp nhận lời mời kết bạn."
            type_socket = "friend_accept"

            Notification.objects.create(
                user=target_user,
                notification_type='friend_request',
                content=content,
                related_id=str(instance.user_to.id)
            )

            payload = {
                "target_user_id": str(target_user.username),
                "data": {
                    "type": type_socket,
                    "sender": instance.user_to.username,
                    "content": content,
                    "created_at": instance.created_at.isoformat()
                }
            }
            redis_client.publish('chat_global', json.dumps(payload))
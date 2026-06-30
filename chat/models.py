# chat/models.py
import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    """
    Bảng A: Users
    Django AbstractUser đã có sẵn: username, password (hash), is_active, v.v.
    Chúng ta override và thêm các trường mới.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone_number = models.CharField(max_length=15, unique=True, null=True, blank=True)
    display_name = models.CharField(max_length=100)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    last_seen = models.DateTimeField(null=True, blank=True)
    # created_at trùng với date_joined có sẵn của AbstractUser, nhưng nếu thích ta khai báo lại
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.username


class Conversation(models.Model):
    """
    Bảng B: Conversations
    """
    CHAT_TYPE_CHOICES = (
        ('private', 'Private'),
        ('group', 'Group'),
    )

    conversation_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    type = models.CharField(max_length=10, choices=CHAT_TYPE_CHOICES, default='private')
    conversation_name = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_message_at = models.DateTimeField(null=True, blank=True)
    
    # Quan hệ Many-to-Many với User thông qua bảng trung gian Participant
    participants = models.ManyToManyField(User, through='Participant', related_name='conversations')

    class Meta:
        ordering = ['-last_message_at'] 
        indexes = [
            models.Index(fields=['-last_message_at']),
        ]
    def __str__(self):
        return self.conversation_name if self.conversation_name else f"Chat {self.conversation_id}"


class Message(models.Model):
    """
    Bảng D: Messages
    Định nghĩa trước Participant vì Participant cần tham chiếu đến Message (last_read)
    """
    MESSAGE_TYPE_CHOICES = (
        ('text', 'Text'),
        ('image', 'Image'),
        ('video', 'Video'),
        ('file', 'File'),
        ('sticker', 'Sticker'),
        ('external_task', 'External Task'),
        ('external_process_task', 'External Process Task'),
    )
    STATUS_CHOICES = (
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('read', 'Read'),
    )

    message_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    content = models.TextField(null=True, blank=True) # Có thể null nếu chỉ gửi ảnh
    message_type = models.CharField(max_length=50, choices=MESSAGE_TYPE_CHOICES, default='text')
    media_url = models.FileField(upload_to='uploads/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='sent')

    class Meta:
        ordering = ['-created_at'] # Mặc định lấy tin mới nhất trước

    def __str__(self):
        return f"{self.sender} -> {self.conversation}: {self.content[:20]}"


class Participant(models.Model):
    """
    Bảng C: Participants (Bảng trung gian)
    """
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('member', 'Member'),
    )

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='member')
    joined_at = models.DateTimeField(auto_now_add=True)
    
    # Liên kết tới tin nhắn cuối cùng đã đọc
    # null=True vì khi mới vào nhóm chưa đọc tin nào
    last_read_message = models.ForeignKey(
        Message, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='read_by_participants'
    )

    class Meta:
        unique_together = ('conversation', 'user') # Một user chỉ tham gia 1 nhóm 1 lần

    def __str__(self):
        return f"{self.user} in {self.conversation}"
    
    
# --- 1. Bảng Mới: Device (Thiết bị) ---
class Device(models.Model):
    """
    Quản lý thiết bị đăng nhập để gửi Push Notification (FCM)
    """
    OS_CHOICES = (
        ('ios', 'iOS'),
        ('android', 'Android'),
        ('web', 'Web'),
    )

    device_id = models.CharField(max_length=255, unique=True) # ID duy nhất của thiết bị
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='devices')
    fcm_token = models.TextField(null=True, blank=True) # Token từ Firebase
    os_type = models.CharField(max_length=10, choices=OS_CHOICES, default='web')
    last_used = models.DateTimeField(auto_now=True) # Cập nhật mỗi lần user mở app
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.os_type}"


# --- 2. Bảng Mới: Contact (Danh bạ / Bạn bè) ---
class Contact(models.Model):
    """
    Quản lý trạng thái kết bạn
    """
    STATUS_CHOICES = (
        ('pending', 'Pending'),   # Đã gửi lời mời
        ('accepted', 'Accepted'), # Đã đồng ý
        ('blocked', 'Blocked'),   # Đã chặn
    )

    user_from = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_requests')
    user_to = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_requests')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Đảm bảo A không thể gửi kết bạn cho B 2 lần
        unique_together = ('user_from', 'user_to') 

    def __str__(self):
        return f"{self.user_from} -> {self.user_to} ({self.status})"


# --- 3. Bảng Mới: Attachment (File đính kèm) ---
class Attachment(models.Model):
    """
    Lưu trữ file tách biệt khỏi bảng Message
    """
    attachment_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Một tin nhắn có thể có nhiều file (ForeignKey)
    message = models.ForeignKey('Message', on_delete=models.CASCADE, related_name='attachments', null=True, blank=True)
    file = models.FileField(upload_to='attachments/%Y/%m/%d/') # Tự động chia thư mục theo ngày
    file_type = models.CharField(max_length=50, null=True, blank=True) # vd: image/jpeg, application/pdf
    file_size = models.IntegerField(default=0) # Lưu dung lượng (bytes)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"File for msg {self.message_id}"
    
    
class Notification(models.Model):
    TYPES = (
        ('message', 'Tin nhắn mới'),
        ('friend_request', 'Lời mời kết bạn'),
        ('system', 'Hệ thống'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=20, choices=TYPES, default='message')
    content = models.TextField() # Nội dung hiển thị (VD: "UserB đã gửi tin nhắn")
    related_id = models.CharField(max_length=50, blank=True, null=True) # ID đoạn chat hoặc ID user gửi
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class ExternalTask(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending Response'),
        ('responded', 'Responded'),
        ('failed', 'Delivery Failed'),
    )

    message = models.OneToOneField(
        Message,
        on_delete=models.CASCADE,
        related_name='external_task',
        db_constraint=False
    )
    task_code = models.CharField(max_length=100, unique=True, db_index=True)
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    target_odoo_user = models.CharField(max_length=150)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Response from Odoo
    response_content = models.TextField(null=True, blank=True)
    responded_by = models.CharField(max_length=150, null=True, blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.task_code} - {self.title} ({self.status})"


class ExternalProcessTask(models.Model):
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('sent', 'Sent'),
        ('done', 'Done'),
        ('failed', 'Failed'),
    )

    message = models.OneToOneField(
        Message,
        on_delete=models.CASCADE,
        related_name='external_process_task',
        db_constraint=False
    )
    task_code = models.CharField(max_length=100, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.task_code} - {self.name} ({self.status})"
# chat/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Conversation, Message, Participant, Device, Contact, Attachment

# 1. Đăng ký User (Sử dụng UserAdmin mặc định để giao diện đẹp hơn)
admin.site.register(User, UserAdmin)

# 2. Đăng ký Conversation
class ParticipantInline(admin.TabularInline):
    model = Participant
    extra = 1

@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ('conversation_id', 'conversation_name', 'type', 'created_at')
    inlines = [ParticipantInline] # Cho phép thêm thành viên ngay trong giao diện tạo Conversation

# 3. Đăng ký Message
@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('sender', 'conversation', 'content', 'created_at')
    list_filter = ('created_at', 'conversation')

# 4. Đăng ký Participant (để xem riêng nếu cần)
admin.site.register(Participant)


# Đăng ký Device
@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ('user', 'os_type', 'last_used', 'created_at')
    list_filter = ('os_type',)

# Đăng ký Contact
@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ('user_from', 'user_to', 'status', 'created_at')
    list_filter = ('status',)

# Đăng ký Attachment
@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = ('attachment_id', 'file_type', 'file_size', 'created_at')
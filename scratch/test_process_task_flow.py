import os
import sys
import django
import json
import uuid

# Setup Django Environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from chat.models import Conversation, Message, ExternalProcessTask
from django.contrib.auth import get_user_model
from django.conf import settings
from rest_framework.test import APIClient
from chat.utils import RedisClient

User = get_user_model()
redis_client = RedisClient.get_client()

def run_test():
    print("--- BẮT ĐẦU TEST ODOO PROCESS TASK FLOW ---")
    
    # 1. Prepare data
    user = User.objects.first()
    if not user:
        user = User.objects.create(username="testadmin", display_name="Test Admin")
        
    conversation = Conversation.objects.first()
    if not conversation:
        conversation = Conversation.objects.create(type="private")
        conversation.participants.add(user)
        
    task_code = f"TEST-PROCESS-{uuid.uuid4().hex[:6].upper()}"
    print(f"1. Khởi tạo dữ liệu. Task Code: {task_code}")
    print(f"   Conversation ID: {conversation.conversation_id}")
    
    client = APIClient()
    webhook_url = f"/api/webhook/odoo-process-task/?conversation_id={conversation.conversation_id}"
    webhook_token = settings.ODOO_TASK_MANAGER_WEBHOOK_TOKEN
    
    payload = {
        "task_code": task_code,
        "task_name": "Test Kịch bản Tự động hóa",
        "description": "Chạy thử nghiệm hệ thống Odoo Process Task"
    }
    
    print(f"\n2. Gửi Webhook từ Odoo giả lập...")
    response = client.post(
        webhook_url, 
        payload, 
        format='json',
        HTTP_AUTHORIZATION=f"Bearer {webhook_token}"
    )
    
    print(f"   HTTP Status: {response.status_code}")
    print(f"   Response Data: {response.data}")
    
    if response.status_code != 200:
        print("❌ LỖI: Webhook gọi thất bại!")
        return
        
    # 3. Verify Database
    print("\n3. Kiểm tra Database Django...")
    task = ExternalProcessTask.objects.filter(task_code=task_code).first()
    if not task:
        print("❌ LỖI: Không tìm thấy task trong DB!")
        return
        
    print(f"   Task Name: {task.name}")
    print(f"   Status: {task.status}")
    if task.status != 'sent':
        print(f"❌ LỖI: Trạng thái không phải là 'sent' (mà là {task.status})")
        return
    print("   ✅ DB OK!")
    
    # 4. Verify Redis Cache (Room Messages)
    print("\n4. Kiểm tra Redis Cache...")
    cache_key = f"room_messages:{conversation.conversation_id}"
    cached_msgs = redis_client.zrange(cache_key, 0, -1)
    found_in_cache = False
    for msg_str in cached_msgs:
        msg = json.loads(msg_str)
        if msg.get('message_type') == 'external_process_task':
            ext_task = msg.get('external_process_task', {})
            if ext_task.get('task_code') == task_code:
                found_in_cache = True
                print(f"   Found in Cache: Task Code = {ext_task.get('task_code')}, Status = {ext_task.get('status')}")
                break
                
    if not found_in_cache:
        print("❌ LỖI: Không tìm thấy message trong Redis Cache!")
    else:
        print("   ✅ Redis OK!")
        
    # Cleanup
    print("\n5. Cleanup...")
    task.message.delete() # this deletes task too due to CASCADE
    print("   ✅ Hoàn thành!")

if __name__ == '__main__':
    run_test()

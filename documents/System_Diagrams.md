# Các Sơ Đồ Kiến Trúc Hệ Thống (System Diagrams)

Tài liệu này chứa các sơ đồ kỹ thuật trực quan cho dự án Chat. Các sơ đồ đã được chuẩn hoá để dễ nhìn nhất và bao phủ toàn bộ các chức năng từ Authentication, Messaging đến Media Handling.

## 1. Sơ Đồ Thực Thể Liên Kết (Entity Relationship Diagram - ERD)
Thay vì sơ đồ lớp phức tạp, mô hình ERD dưới đây mô tả trực quan cấu trúc Database cốt lõi của hệ thống:

```mermaid
erDiagram
    USER ||--o{ CONTACT : "has"
    USER ||--o{ DEVICE : "owns"
    USER ||--o{ NOTIFICATION : "receives"
    USER ||--o{ PARTICIPANT : "is"
    CHATROOM ||--o{ PARTICIPANT : "contains"
    CHATROOM ||--o{ MESSAGE : "contains"
    MESSAGE ||--o{ ATTACHMENT : "has"
    USER ||--o{ MESSAGE : "sends"

    USER {
        UUID id
        string username
        string display_name
    }
    CHATROOM {
        UUID conversation_id
        string type
        string conversation_name
    }
    MESSAGE {
        UUID message_id
        string content
        string status
    }
    ATTACHMENT {
        UUID attachment_id
        string file_type
        int file_size
        string file_url
    }
```

## 2. Sơ Đồ Kiến Trúc Thành Phần (Architecture Components)
Mô tả sự tương tác giữa các service nội bộ và dịch vụ bên thứ ba:

```mermaid
graph TD
    subgraph Clients
        Web[Frontend Web App]
        Mobile[Mobile App]
    end

    subgraph Infrastructure
        Proxy[Nginx / Load Balancer]
    end

    subgraph Backend Services
        API[Django API Server]
        WS[Rust WebSocket Server]
    end

    subgraph Data & Storage
        DB[(PostgreSQL)]
        Redis[(Redis Pub/Sub)]
        Storage[(Media Storage)]
        FCM[Firebase Cloud Messaging]
    end

    Web -->|HTTPS / WSS| Proxy
    Mobile -->|HTTPS / WSS| Proxy

    Proxy -->|REST API| API
    Proxy -->|WebSocket| WS

    API -->|Read/Write| DB
    API -->|Publish| Redis
    Redis -->|Subscribe| WS

    API -->|Upload/Fetch| Storage
    API -->|Trigger Push| FCM
    FCM -.->|Push Notif| Mobile
```

---

## 3. Các Sơ Đồ Tuần Tự (Sequence Diagrams)

### 3.1 Luồng Đăng Nhập & Khởi Tạo Ứng Dụng (Login & Initialization Flow)
Luồng này không chỉ dừng ở việc cấp JWT Token, mà còn mô tả chi tiết chuỗi hành động (chuẩn bị dữ liệu, đăng ký nhận Push Notification, kết nối Realtime) mà Client bắt buộc phải làm ngay sau khi đăng nhập thành công để sẵn sàng trải nghiệm Chat.

```mermaid
sequenceDiagram
    participant C as Client (Web/Mobile)
    participant FCM as Firebase (Push)
    participant API as Django API Server
    participant DB as PostgreSQL
    participant WS as Rust WS Server

    Note over C,DB: 1. XÁC THỰC NGƯỜI DÙNG (Authentication)
    C->>API: POST /api/login (username, password)
    API->>DB: Kiểm tra Mật khẩu Hash & Trạng thái User
    DB-->>API: Dữ liệu Hợp lệ
    API->>API: Khởi tạo Access Token & Refresh Token (JWT)
    API-->>C: Trả về Token (Web: Cấp HttpOnly Cookie / Mobile: Trả JSON)
    C->>C: Lưu Token (Web: Lưu RAM / Mobile: Lưu SecureStore)

    Note over C,API: 2. TẢI DỮ LIỆU BAN ĐẦU (Initial Data Fetching)
    par Tải song song để tối ưu tốc độ
        C->>API: GET /api/conversations (Lấy DS Phòng Chat)
        API-->>C: JSON Danh sách Room & Tin nhắn mới nhất
    and
        C->>API: GET /api/contacts (Lấy Danh Bạ)
        API-->>C: JSON Danh sách Bạn bè (Online/Offline)
    and
        C->>API: GET /api/notifications
        API-->>C: JSON Các thông báo chưa đọc
    end

    Note over C,FCM: 3. ĐĂNG KÝ THIẾT BỊ NHẬN PUSH NOTIFICATION [Đặc thù Mobile]
    C->>FCM: Yêu cầu FCM Device Token từ hệ điều hành
    FCM-->>C: Trả về chuỗi fcm_token duy nhất
    C->>API: POST /api/devices (Gửi fcm_token & OS_type)
    API->>DB: Lưu/Cập nhật bản ghi Device của User
    API-->>C: 200 OK (Sẵn sàng nhận Push khi Offline)

    Note over C,WS: 4. THIẾT LẬP KẾT NỐI REALTIME (Online)
    C->>WS: Mở kết nối WebSocket (Kèm JWT Token)
    WS-->>C: 101 Switching Protocols
    C->>C: Render toàn bộ UI, User sẵn sàng sử dụng App!
```

### 3.2 Luồng Giao Tiếp Realtime (Gửi/Nhận Tin Nhắn Văn Bản)
Luồng này mô tả toàn bộ vòng đời của một tin nhắn: từ lúc Client cập nhật UI ảo (Optimistic Update), Server kiểm tra quyền, lưu vào DB, cho đến quá trình chạy song song (Phân phát qua Redis & Bắn Push qua Firebase).

```mermaid
sequenceDiagram
    participant Sender as Người gửi (Client A)
    participant FCM as Firebase (Push)
    participant API as Django Backend
    participant DB as PostgreSQL
    participant Redis as Redis Broker
    participant WS as Rust WS Server
    participant Receiver as Người nhận (Client B)

    Note over Sender: 1. Giao diện Phản hồi Tức thì (Optimistic UI Update)
    Sender->>Sender: Render tin nhắn mờ (Trạng thái: "Đang gửi...") kèm local_id
    
    Note over Sender,DB: 2. XỬ LÝ ĐỒNG BỘ (Kiểm tra & Lưu Database)
    Sender->>API: POST /api/messages (room_id, content, local_id)
    API->>DB: Truy vấn quyền tham gia phòng (Check Participant)
    
    alt Không có quyền truy cập
        DB-->>API: Trả về False / Không tìm thấy
        API-->>Sender: HTTP 403 Forbidden (Báo lỗi)
        Sender->>Sender: Đổi trạng thái tin nhắn thành "Lỗi gửi" (Màu đỏ)
    else Hợp lệ (Bắt đầu Database Transaction)
        API->>DB: 1. INSERT bản ghi mới vào bảng Message
        API->>DB: 2. UPDATE last_message_at cho bảng Conversation
        DB-->>API: Hoàn tất Transaction, trả về Message_ID
        API-->>Sender: HTTP 201 (Message_ID, local_id, status: "Sent")
        Sender->>Sender: Cập nhật UI: Đổi trạng thái từ "Đang gửi" -> "Đã gửi"

        Note over API,Receiver: 3. XỬ LÝ BẤT ĐỒNG BỘ SONG SONG (Realtime & Push)
        par Xử lý Push Notification [Đặc thù Mobile]
            API-)DB: Truy vấn danh sách thiết bị của User đang Offline
            API-)FCM: Gửi payload Push Notification
            FCM-)Receiver: [Mobile Only] Rung điện thoại & Hiện thông báo ngoài màn hình
        and Xử lý Realtime Broadcast (Chạy ngầm)
            API-)Redis: PUBLISH kênh 'chat_room_<id>' (Payload JSON)
            Redis-)WS: Bắn Event có tin nhắn mới sang tiến trình Rust
            WS->>WS: Lọc danh sách WebSocket Session thuộc phòng chat
            WS-)Receiver: Broadcast gói tin JSON (New Message) qua WebSocket
            Receiver->>Receiver: Thêm tin nhắn vào Virtual DOM (Hiển thị tức thời)
            
            Note over Receiver,API: 4. Luồng Xác Nhận Đã Đọc (Read Receipt)
            Receiver-)API: Gọi nền POST /api/messages/{id}/read
            API-)DB: Update bảng Participant (Trường last_read_message)
        end
    end
```

### 3.3 Luồng Tải Lên và Xem Đa Phương Tiện (Hình Ảnh / Video / File)
Đối với file tĩnh nặng (Video, Ảnh), hệ thống không truyền file nhị phân qua WebSocket để tránh tắc nghẽn. WebSocket chỉ truyền URL, Client sẽ tự tải file về qua giao thức HTTP tĩnh.

```mermaid
sequenceDiagram
    participant C1 as Người gửi
    participant Nginx as Nginx Proxy
    participant API as Django Backend
    participant Storage as File Storage (Local/S3)
    participant WS as Rust WS
    participant C2 as Người nhận

    Note over C1,Storage: 1. Tiến trình Upload File
    C1->>Nginx: POST /api/messages (multipart/form-data) chứa Ảnh/Video
    Nginx->>API: Forward File & Validate
    API->>Storage: Lưu File Vật Lý
    Storage-->>API: Trả về media_url (vd: /media/video.mp4)
    API->>API: Lưu Message & Attachment vào DB với URL
    API-->>C1: HTTP 201 (Message_ID, media_url)

    Note over API,C2: 2. Phát thông báo tin nhắn mới
    API-)WS: [Redis] Báo có tin nhắn loại 'video' kèm media_url
    WS-)C2: Broadcast JSON {type: "video", url: "/media/video.mp4"}

    Note over C2,Storage: 3. Tiến trình Streaming/Fetch Media
    C2->>Nginx: GET /media/video.mp4
    Nginx->>Storage: Lấy file vật lý (Hoặc lấy từ Nginx Cache)
    Storage-->>Nginx: Trả file dạng Stream (chunk)
    Nginx-->>C2: Phát video / Hiển thị hình ảnh mượt mà
```

### 3.4 Vòng Đời Kết Nối WebSocket (Connection Lifecycle)
Sơ đồ mô tả chi tiết từ lúc khởi tạo kết nối (Handshake), xác thực bảo mật, đăng ký kênh nhận tin (Subscribe), duy trì kết nối (Heartbeat) cho đến khi người dùng mất mạng và hệ thống dọn dẹp bộ nhớ.

```mermaid
sequenceDiagram
    participant C as Client (Web/Mobile)
    participant Nginx as Proxy Server
    participant WS as Rust WS Server
    participant Redis as Redis (Pub/Sub & Status)
    participant API as Django Backend
    participant DB as PostgreSQL

    Note over C,DB: 1. KHỞI TẠO & XÁC THỰC KẾT NỐI (Handshake & Auth)
    C->>Nginx: Lệnh kết nối: ws://domain.com/ws?token=JWT
    Nginx->>WS: Upgrade to WebSocket (Forward)
    
    alt Không có Token hoặc định dạng sai
        WS-->>C: Đóng kết nối (HTTP 401 Unauthorized)
    else Có Token
        WS->>API: Gọi nội bộ (RPC/HTTP) để xác thực JWT
        API->>DB: Truy vấn trạng thái User (Có bị khoá không?)
        
        alt Token hết hạn / User bị khoá
            API-->>WS: Invalid / Banned
            WS-->>C: Đóng kết nối (HTTP 403 Forbidden)
        else Hợp lệ
            API-->>WS: Trả về User_ID & Danh sách Room_IDs
            WS-->>C: HTTP 101 Switching Protocols (Thành công)
            
            Note over WS,Redis: 2. ĐĂNG KÝ NHẬN TIN (Subscription)
            WS->>WS: Lưu (User_ID, WebSocket_Session) vào RAM
            WS->>Redis: SUBSCRIBE vào các kênh 'chat_room_<id>' của User
            WS->>Redis: Set trạng thái "Online" cho User_ID
            WS--)C: Bắn Event: "Connected & Subscribed Successfully"
        end
    end

    Note over C,WS: 3. CƠ CHẾ DUY TRÌ KẾT NỐI (Heartbeat / Ping-Pong)
    loop Mỗi 30 giây
        C->>WS: Gửi tín hiệu PING
        WS->>Redis: (Tuỳ chọn) Update TTL duy trì trạng thái "Online"
        WS-->>C: Gửi tín hiệu PONG
        
        opt Không nhận được PING sau 60s
            WS->>WS: Đánh dấu Session là Dead (Connection Timeout)
            WS-->>C: Ép đóng kết nối (Force Close)
        end
    end
    
    Note over C,DB: 4. NGẮT KẾT NỐI & DỌN DẸP TÀI NGUYÊN (Cleanup)
    C->>WS: Trình duyệt đóng / Mất kết nối mạng đột ngột
    WS->>Redis: UNSUBSCRIBE khỏi tất cả các kênh chat_room
    WS->>Redis: Xoá trạng thái "Online"
    WS->>WS: Dọn dẹp Session khỏi RAM (Chống Memory Leak)
    WS-)API: [Bất đồng bộ] Thông báo User đã Offline
    API->>DB: Cập nhật trường `last_seen` của User vào DB
```

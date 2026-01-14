// src/handlers.rs
use warp::ws::Message;

// Hàm này chỉ tập trung vào việc: Nhận tin nhắn -> Xử lý nghiệp vụ
pub async fn handle_incoming_message(msg: Message, username: &str) -> bool {
    // 1. Kiểm tra nếu là tin nhắn đóng kết nối
    if msg.is_close() {
        return false; // Báo hiệu để ngắt kết nối
    }

    // 2. Xử lý tin nhắn văn bản
    if msg.is_text() {
        let text = msg.to_str().unwrap_or("");
        println!("📩 Received from {}: {}", username, text);
        
        // --- CHỖ NÀY ĐỂ CODE LOGIC NGHIỆP VỤ ---
        // Ví dụ: Parse JSON để xem user muốn gửi ảnh, hay đang typing...
        // let data: MyStruct = serde_json::from_str(text)...
    }

    // 3. Xử lý Ping (để giữ kết nối)
    if msg.is_ping() {
        println!("ping from {}", username);
    }

    return true; // Tiếp tục giữ kết nối
}
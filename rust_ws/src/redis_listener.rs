use crate::models::RedisPayload;
use crate::state::Users;
use futures::StreamExt; // Cần thiết cho pubsub.on_message().next()

pub async fn run(users: Users) {
    let client = redis::Client::open("redis://127.0.0.1/").expect("Invalid Redis URL");
    let mut con = client.get_async_connection().await.expect("Cannot connect to Redis");
    let mut pubsub = con.into_pubsub();

    pubsub.subscribe("chat_global").await.expect("Cannot subscribe");
    println!("✅ Rust is listening on Redis channel: chat_global");

    while let Some(msg) = pubsub.on_message().next().await {
        let payload_str: String = msg.get_payload().unwrap_or_default();
        
        if let Ok(payload) = serde_json::from_str::<RedisPayload>(&payload_str) {
            let users_clone = users.clone();
            
            // Logic gửi tin nhắn xuống client
            // Lưu ý: Không cần lock toàn cục quá lâu, chỉ lock scope nhỏ
            let sender_opt = {
                let locked_users = users_clone.lock().unwrap();
                locked_users.get(&payload.target_user_id).cloned()
            };

            if let Some(sender) = sender_opt {
                let json_msg = serde_json::to_string(&payload.data).unwrap_or_default();
                if let Err(_disconnected) = sender.send(warp::ws::Message::text(json_msg)) {
                    // Client đã ngắt kết nối, có thể log hoặc bỏ qua
                }
            }
        }
    }
}
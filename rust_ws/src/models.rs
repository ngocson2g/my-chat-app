use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct RedisPayload {
    pub target_user_id: String,
    pub data: serde_json::Value,
}
# chat/migrations/0006_partition_message_table.py
from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('chat', '0005_alter_conversation_options_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql='''
            -- 1. Xoá khoá ngoại từ bảng participant trỏ tới bảng message 
            -- (Vì Postgres bắt buộc FK tới bảng Partition phải bao gồm cả Partition Key)
            ALTER TABLE "chat_participant" DROP CONSTRAINT IF EXISTS "chat_participant_last_read_message_id_01427ba8_fk_chat_mess";

            -- 2. Đổi tên bảng cũ
            ALTER TABLE "chat_message" RENAME TO "chat_message_old";

            -- 3. Tạo bảng Partition mới (Lưu ý: Primary Key phải bao gồm created_at)
            CREATE TABLE "chat_message" (
                "message_id" uuid NOT NULL,
                "content" text NULL,
                "message_type" varchar(10) NOT NULL,
                "media_url" varchar(100) NULL,
                "created_at" timestamp with time zone NOT NULL,
                "status" varchar(10) NOT NULL,
                "conversation_id" uuid NOT NULL,
                "sender_id" uuid NOT NULL,
                PRIMARY KEY ("message_id", "created_at")
            ) PARTITION BY RANGE ("created_at");

            -- 4. Tạo các Index cần thiết
            CREATE INDEX "chat_message_conversation_id_idx" ON "chat_message" ("conversation_id");
            CREATE INDEX "chat_message_sender_id_idx" ON "chat_message" ("sender_id");

            -- 5. Tạo Partition đầu tiên (Tháng 6/2026)
            CREATE TABLE "chat_message_y2026m06" PARTITION OF "chat_message"
                FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');

            -- 6. Copy dữ liệu (Nếu có)
            -- Bỏ qua bước copy nếu DB trống, hoặc viết lệnh copy nếu cần:
            -- INSERT INTO "chat_message" SELECT * FROM "chat_message_old" WHERE created_at >= '2026-06-01 00:00:00+00';

            -- 7. Xoá bảng cũ (Nguy hiểm: Cần backup trước khi chạy trên Production)
            -- DROP TABLE "chat_message_old" CASCADE;
            ''',
            reverse_sql='''
            -- Phục hồi lại trạng thái cũ
            ALTER TABLE "chat_message" RENAME TO "chat_message_partitioned";
            ALTER TABLE "chat_message_old" RENAME TO "chat_message";
            ALTER TABLE "chat_participant" ADD CONSTRAINT "chat_participant_last_read_message_id_01427ba8_fk_chat_mess" FOREIGN KEY ("last_read_message_id") REFERENCES "chat_message" ("message_id") DEFERRABLE INITIALLY DEFERRED;
            '''
        )
    ]

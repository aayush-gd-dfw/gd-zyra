"""
Remove duplicate zyra_calls records and add a proper unique index.
Run ONCE after deploying the dedup fix:
  docker exec gd-zyra-backend-1 python3 /app/cleanup_duplicates.py
"""
import asyncio, sys
sys.path.insert(0, "/app")
from database import AsyncSessionLocal
from sqlalchemy import text


async def main():
    async with AsyncSessionLocal() as db:
        r = await db.execute(text("SELECT COUNT(*) FROM zyra_calls"))
        total_before = r.scalar()
        print(f"Total calls before cleanup: {total_before}")

        # 1. Delete duplicates by graph_message_id — keep the oldest row per ID
        res1 = await db.execute(text("""
            DELETE FROM zyra_calls
            WHERE id IN (
                SELECT id FROM (
                    SELECT id,
                           ROW_NUMBER() OVER (
                               PARTITION BY graph_message_id
                               ORDER BY created_at ASC
                           ) AS rn
                    FROM zyra_calls
                    WHERE graph_message_id IS NOT NULL
                ) t
                WHERE rn > 1
            )
        """))
        print(f"Deleted {res1.rowcount} duplicates by graph_message_id")

        # 2. Delete duplicates by subject + minute bucket (for rows with NULL message_id)
        res2 = await db.execute(text("""
            DELETE FROM zyra_calls
            WHERE id IN (
                SELECT id FROM (
                    SELECT id,
                           ROW_NUMBER() OVER (
                               PARTITION BY email_subject, DATE_TRUNC('minute', received_at)
                               ORDER BY created_at ASC
                           ) AS rn
                    FROM zyra_calls
                    WHERE graph_message_id IS NULL
                ) t
                WHERE rn > 1
            )
        """))
        print(f"Deleted {res2.rowcount} duplicates by subject+time (null message_id)")

        await db.commit()

        # 3. Now safe to add partial unique index
        try:
            await db.execute(text("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_zyra_calls_msg_id
                ON zyra_calls(graph_message_id)
                WHERE graph_message_id IS NOT NULL
            """))
            await db.commit()
            print("Unique index on graph_message_id created (or already existed).")
        except Exception as e:
            print(f"Warning: could not create unique index — {e}")

        r = await db.execute(text("SELECT COUNT(*) FROM zyra_calls"))
        total_after = r.scalar()
        print(f"Total calls after cleanup: {total_after} (removed {total_before - total_after})")
        print("Done.")


asyncio.run(main())

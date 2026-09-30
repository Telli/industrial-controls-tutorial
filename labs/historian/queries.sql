-- Lab 7 queries. Parameters use :name placeholders (Microsoft.Data.Sqlite, Python sqlite3 and the sqlite3 CLI all accept them).

-- Q1  Insert one sample. INSERT OR IGNORE makes a replay of the same (tag, boot, sequence) harmless.
INSERT OR IGNORE INTO sample (tag_key, receive_ms, source_ms, value, quality, sequence, boot_id)
VALUES (:tag_key, :receive_ms, :source_ms, :value, :quality, :sequence, :boot_id);

-- Q2  Raw trend for one tag and window. Check with EXPLAIN QUERY PLAN that it uses sample_by_time.
SELECT receive_ms, value, quality
FROM sample
WHERE tag_key = :tag_key AND receive_ms >= :from_ms AND receive_ms < :to_ms
ORDER BY receive_ms;

-- Q3  One-minute summary that keeps excursions and states coverage honestly.
--     good_count / expected_count says how much of the minute is actually evidenced.
SELECT (receive_ms / 60000) * 60000                      AS minute_ms,
       COUNT(*)                                          AS rows_received,
       SUM(quality = 'Good')                             AS good_count,
       :expected_per_minute                              AS expected_count,
       MIN(CASE WHEN quality = 'Good' THEN value END)    AS min_value,
       MAX(CASE WHEN quality = 'Good' THEN value END)    AS max_value,
       AVG(CASE WHEN quality = 'Good' THEN value END)    AS mean_value
FROM sample
WHERE tag_key = :tag_key AND receive_ms >= :from_ms AND receive_ms < :to_ms
GROUP BY minute_ms
ORDER BY minute_ms;

-- Q4  Find gaps: consecutive rows further apart than the stale threshold.
SELECT prev_ms, receive_ms AS resumed_ms, receive_ms - prev_ms AS gap_ms
FROM (SELECT receive_ms, LAG(receive_ms) OVER (ORDER BY receive_ms) AS prev_ms
      FROM sample
      WHERE tag_key = :tag_key AND receive_ms >= :from_ms AND receive_ms < :to_ms)
WHERE receive_ms - prev_ms > :stale_ms;

-- Q5  Complete a batch AND enqueue its business event atomically.
BEGIN IMMEDIATE;
UPDATE batch SET status = 'Completed', quantity = :quantity, completed_ms = :now_ms
 WHERE batch_id = :batch_id AND status = 'Running';
INSERT INTO outbox (event_id, event_type, payload_json, created_ms, next_try_ms)
SELECT :batch_id || ':completed', 'BatchCompleted',
       json_object('batchId', :batch_id, 'quantity', :quantity, 'completedMs', :now_ms), :now_ms, :now_ms
 WHERE changes() = 1;        -- only if the UPDATE really completed a running batch
COMMIT;

-- Q6  Pending outbox work, oldest first.
SELECT event_id, event_type, payload_json, attempts FROM outbox
WHERE delivered_ms IS NULL AND next_try_ms <= :now_ms
ORDER BY created_ms LIMIT 50;

-- Q7  Retention for one tag: delete samples older than the cut-off in bounded chunks
--     so one huge delete does not hold the write lock or balloon the WAL. Repeat until 0 rows change.
DELETE FROM sample
WHERE (tag_key, boot_id, sequence) IN (
    SELECT tag_key, boot_id, sequence FROM sample
    WHERE tag_key = :tag_key AND receive_ms < :cutoff_ms
    LIMIT 5000);

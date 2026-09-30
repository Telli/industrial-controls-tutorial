-- Lab 7: a local historian and outbox schema for the simulated tank.
-- SQLite 3.35+ (RETURNING is not used; window functions need 3.25+).
-- Times are stored as INTEGER Unix milliseconds (UTC) so range scans and indexes stay cheap.

PRAGMA journal_mode = WAL;       -- returns 'wal' when it took effect; check it, do not assume
PRAGMA synchronous = NORMAL;     -- in WAL mode: durable at checkpoint; a power cut can lose the last commits
PRAGMA foreign_keys = ON;        -- per connection, not stored in the file

CREATE TABLE IF NOT EXISTS tag (
    tag_key          INTEGER PRIMARY KEY,
    asset_id         TEXT    NOT NULL,
    tag_id           TEXT    NOT NULL,
    unit             TEXT    NOT NULL,
    mapping_version  INTEGER NOT NULL,
    UNIQUE (asset_id, tag_id)
);

-- One row per received observation. Quality is stored, never filtered out on insert:
-- a gap with a reason is evidence; a silently missing row is not.
CREATE TABLE IF NOT EXISTS sample (
    tag_key          INTEGER NOT NULL REFERENCES tag(tag_key),
    receive_ms       INTEGER NOT NULL,          -- acquisition clock
    source_ms        INTEGER,                   -- device clock, NULL when the device has none
    value            REAL,                      -- NULL when quality says there is no usable value
    quality          TEXT    NOT NULL CHECK (quality IN ('Good','Stale','BadCommunication','BadSensor','BadConfiguration')),
    sequence         INTEGER NOT NULL,
    boot_id          TEXT    NOT NULL,
    PRIMARY KEY (tag_key, boot_id, sequence)    -- a replayed sample is rejected, not duplicated
) WITHOUT ROWID;

-- The query every trend makes: one tag, one time window.
CREATE INDEX IF NOT EXISTS sample_by_time ON sample (tag_key, receive_ms);

CREATE TABLE IF NOT EXISTS alarm_event (
    event_id     TEXT PRIMARY KEY,
    alarm_id     TEXT    NOT NULL,
    transition   TEXT    NOT NULL,
    state        TEXT    NOT NULL,
    at_ms        INTEGER NOT NULL,
    value        REAL,
    quality      TEXT    NOT NULL,
    actor        TEXT
);
CREATE INDEX IF NOT EXISTS alarm_by_time ON alarm_event (alarm_id, at_ms);

CREATE TABLE IF NOT EXISTS batch (
    batch_id      TEXT PRIMARY KEY,
    asset_id      TEXT    NOT NULL,
    status        TEXT    NOT NULL CHECK (status IN ('Running','Completed','Aborted')),
    quantity      INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    completed_ms  INTEGER
);

-- Transactional outbox: written in the SAME transaction as the batch change it describes.
CREATE TABLE IF NOT EXISTS outbox (
    event_id      TEXT PRIMARY KEY,
    event_type    TEXT    NOT NULL,
    payload_json  TEXT    NOT NULL,
    created_ms    INTEGER NOT NULL,
    attempts      INTEGER NOT NULL DEFAULT 0,
    next_try_ms   INTEGER NOT NULL,
    delivered_ms  INTEGER
);
CREATE INDEX IF NOT EXISTS outbox_pending ON outbox (next_try_ms) WHERE delivered_ms IS NULL;

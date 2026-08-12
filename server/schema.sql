CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS conversations (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title text NOT NULL DEFAULT '私密对话',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz,
    mode_tag text
);

CREATE TABLE IF NOT EXISTS messages (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id bigint NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sequence_no integer NOT NULL CHECK (sequence_no BETWEEN 1 AND 400),
    role text NOT NULL CHECK (role IN ('user', 'assistant')),
    content text NOT NULL CHECK (length(content) > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (conversation_id, sequence_no)
);

CREATE TABLE IF NOT EXISTS memories (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_message_id bigint REFERENCES messages(id) ON DELETE SET NULL,
    content text NOT NULL UNIQUE CHECK (length(content) > 0),
    fingerprint text,
    scope_tag text,
    embedding vector NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_recalled_at timestamptz
);

CREATE TABLE IF NOT EXISTS encryption_config (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    salt text NOT NULL,
    verifier text NOT NULL CHECK (verifier LIKE 'enc:v1:%'),
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE memories ADD COLUMN IF NOT EXISTS fingerprint text;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS scope_tag text;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS mode_tag text;
DROP INDEX IF EXISTS memories_fingerprint_idx;
CREATE UNIQUE INDEX IF NOT EXISTS memories_scope_fingerprint_idx ON memories (scope_tag, fingerprint);
CREATE INDEX IF NOT EXISTS memories_scope_tag_idx ON memories (scope_tag);
UPDATE conversations SET title = '私密对话' WHERE title <> '私密对话';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_content_encrypted_check') THEN
        ALTER TABLE messages ADD CONSTRAINT messages_content_encrypted_check
            CHECK (content LIKE 'enc:v1:%') NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'memories_content_encrypted_check') THEN
        ALTER TABLE memories ADD CONSTRAINT memories_content_encrypted_check
            CHECK (content LIKE 'enc:v1:%') NOT VALID;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS messages_conversation_id_idx
    ON messages (conversation_id, sequence_no);

CREATE INDEX IF NOT EXISTS messages_created_at_idx
    ON messages (created_at DESC);

CREATE INDEX IF NOT EXISTS memories_created_at_idx
    ON memories (created_at DESC);

REVOKE ALL ON conversations, messages, memories, encryption_config FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversations, messages, memories, encryption_config TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

CREATE OR REPLACE FUNCTION lucia_health()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT true;
$$;

CREATE OR REPLACE FUNCTION lucia_get_encryption_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
    SELECT CASE WHEN config.singleton IS NULL THEN NULL ELSE jsonb_build_object(
        'salt', config.salt,
        'verifier', config.verifier
    ) END
    FROM (SELECT true) AS one
    LEFT JOIN encryption_config config ON config.singleton = true;
$$;

CREATE OR REPLACE FUNCTION lucia_set_encryption_config(p_salt text, p_verifier text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    config encryption_config%ROWTYPE;
BEGIN
    IF length(p_salt) < 20 OR p_verifier NOT LIKE 'enc:v1:%' THEN
        RAISE EXCEPTION 'invalid encryption config';
    END IF;
    INSERT INTO encryption_config (singleton, salt, verifier)
    VALUES (true, p_salt, p_verifier)
    ON CONFLICT (singleton) DO NOTHING;
    SELECT * INTO config FROM encryption_config WHERE singleton = true;
    RETURN jsonb_build_object('salt', config.salt, 'verifier', config.verifier);
END;
$$;

CREATE OR REPLACE FUNCTION lucia_list_legacy_memories()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', id::text, 'content', content)), '[]'::jsonb)
    FROM memories
    WHERE content NOT LIKE 'enc:v1:%';
$$;

CREATE OR REPLACE FUNCTION lucia_migrate_encrypted_data(p_messages jsonb, p_memories jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    message_count integer := 0;
    memory_count integer := 0;
BEGIN
    UPDATE messages target
    SET content = item.value->>'content'
    FROM jsonb_array_elements(coalesce(p_messages, '[]'::jsonb)) AS item(value)
    WHERE target.id = (item.value->>'id')::bigint
      AND target.content NOT LIKE 'enc:v1:%'
      AND item.value->>'content' LIKE 'enc:v1:%';
    GET DIAGNOSTICS message_count = ROW_COUNT;

    UPDATE memories target
    SET content = item.value->>'content',
        fingerprint = item.value->>'fingerprint'
    FROM jsonb_array_elements(coalesce(p_memories, '[]'::jsonb)) AS item(value)
    WHERE target.id = (item.value->>'id')::bigint
      AND target.content NOT LIKE 'enc:v1:%'
      AND item.value->>'content' LIKE 'enc:v1:%'
      AND length(coalesce(item.value->>'fingerprint', '')) > 0;
    GET DIAGNOSTICS memory_count = ROW_COUNT;

    RETURN jsonb_build_object('messages', message_count, 'memories', memory_count);
END;
$$;

CREATE OR REPLACE FUNCTION lucia_list_conversations()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
    SELECT coalesce(
        jsonb_agg((to_jsonb(item) - 'numeric_id') ORDER BY item.updated_at DESC, item.numeric_id DESC),
        '[]'::jsonb
    )
    FROM (
        SELECT
            c.id AS numeric_id,
            c.id::text AS id,
            '私密对话'::text AS title,
            c.created_at,
            c.updated_at,
            c.ended_at,
            c.mode_tag,
            count(m.id)::integer AS message_count
        FROM conversations c
        LEFT JOIN messages m ON m.conversation_id = c.id
        GROUP BY c.id
    ) AS item;
$$;

CREATE OR REPLACE FUNCTION lucia_create_scoped_conversation(p_mode_tag text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    created conversations%ROWTYPE;
BEGIN
    IF length(coalesce(p_mode_tag, '')) NOT BETWEEN 20 AND 100 THEN
        RAISE EXCEPTION 'invalid mode tag';
    END IF;
    UPDATE conversations SET ended_at = now() WHERE ended_at IS NULL;
    INSERT INTO conversations (mode_tag) VALUES (p_mode_tag) RETURNING * INTO created;
    RETURN jsonb_build_object(
        'id', created.id::text,
        'title', created.title,
        'mode_tag', created.mode_tag,
        'created_at', created.created_at,
        'updated_at', created.updated_at,
        'ended_at', created.ended_at,
        'message_count', 0
    );
END;
$$;

CREATE OR REPLACE FUNCTION lucia_import_scoped_legacy_conversation(
    p_mode_tag text,
    p_messages jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    created conversations%ROWTYPE;
    imported_count integer;
BEGIN
    IF EXISTS (SELECT 1 FROM conversations) OR length(coalesce(p_mode_tag, '')) NOT BETWEEN 20 AND 100 THEN
        RETURN NULL;
    END IF;
    INSERT INTO conversations (title, mode_tag) VALUES ('私密对话', p_mode_tag)
    RETURNING * INTO created;
    INSERT INTO messages (conversation_id, sequence_no, role, content)
    SELECT created.id, item.ordinality::integer, item.message->>'role', item.message->>'content'
    FROM jsonb_array_elements(p_messages) WITH ORDINALITY AS item(message, ordinality)
    WHERE item.message->>'role' IN ('user', 'assistant')
      AND item.message->>'content' LIKE 'enc:v1:%'
      AND item.ordinality <= 400;
    GET DIAGNOSTICS imported_count = ROW_COUNT;
    RETURN jsonb_build_object(
        'id', created.id::text,
        'title', created.title,
        'mode_tag', created.mode_tag,
        'created_at', created.created_at,
        'updated_at', created.updated_at,
        'ended_at', created.ended_at,
        'message_count', imported_count
    );
END;
$$;

CREATE OR REPLACE FUNCTION lucia_assign_legacy_scope(p_mode_tag text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    conversation_count integer;
    memory_count integer;
BEGIN
    IF length(coalesce(p_mode_tag, '')) NOT BETWEEN 20 AND 100 THEN
        RAISE EXCEPTION 'invalid mode tag';
    END IF;
    UPDATE conversations SET mode_tag = p_mode_tag WHERE mode_tag IS NULL;
    GET DIAGNOSTICS conversation_count = ROW_COUNT;
    UPDATE memories SET scope_tag = p_mode_tag WHERE scope_tag IS NULL;
    GET DIAGNOSTICS memory_count = ROW_COUNT;
    RETURN jsonb_build_object('conversations', conversation_count, 'memories', memory_count);
END;
$$;

CREATE OR REPLACE FUNCTION lucia_create_conversation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    created conversations%ROWTYPE;
BEGIN
    UPDATE conversations SET ended_at = now() WHERE ended_at IS NULL;
    INSERT INTO conversations DEFAULT VALUES RETURNING * INTO created;
    RETURN jsonb_build_object(
        'id', created.id::text,
        'title', created.title,
        'created_at', created.created_at,
        'updated_at', created.updated_at,
        'ended_at', created.ended_at,
        'message_count', 0
    );
END;
$$;

CREATE OR REPLACE FUNCTION lucia_import_legacy_conversation(
    p_title text,
    p_messages jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    created conversations%ROWTYPE;
    imported_count integer;
BEGIN
    IF EXISTS (SELECT 1 FROM conversations) THEN
        RETURN NULL;
    END IF;

    INSERT INTO conversations (title)
    VALUES ('私密对话')
    RETURNING * INTO created;

    INSERT INTO messages (conversation_id, sequence_no, role, content)
    SELECT
        created.id,
        item.ordinality::integer,
        item.message->>'role',
        item.message->>'content'
    FROM jsonb_array_elements(p_messages) WITH ORDINALITY AS item(message, ordinality)
    WHERE item.message->>'role' IN ('user', 'assistant')
      AND item.message->>'content' LIKE 'enc:v1:%'
      AND item.ordinality <= 400;

    GET DIAGNOSTICS imported_count = ROW_COUNT;
    RETURN jsonb_build_object(
        'id', created.id::text,
        'title', created.title,
        'created_at', created.created_at,
        'updated_at', created.updated_at,
        'ended_at', created.ended_at,
        'message_count', imported_count
    );
END;
$$;

CREATE OR REPLACE FUNCTION lucia_get_messages(p_conversation_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    result jsonb;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM conversations WHERE id = p_conversation_id) THEN
        RETURN NULL;
    END IF;

    SELECT coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', id::text,
                'role', role,
                'content', content,
                'sequence_no', sequence_no,
                'created_at', created_at
            )
            ORDER BY sequence_no
        ),
        '[]'::jsonb
    )
    INTO result
    FROM messages
    WHERE conversation_id = p_conversation_id;

    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION lucia_delete_conversation(p_conversation_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    DELETE FROM conversations WHERE id = p_conversation_id;
    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION lucia_append_message(
    p_conversation_id bigint,
    p_role text,
    p_content text,
    p_title text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    locked_id bigint;
    next_sequence integer;
    saved_message jsonb;
BEGIN
    IF p_role NOT IN ('user', 'assistant') OR p_content NOT LIKE 'enc:v1:%' THEN
        RAISE EXCEPTION 'invalid message';
    END IF;

    SELECT id INTO locked_id
    FROM conversations
    WHERE id = p_conversation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    SELECT coalesce(max(sequence_no), 0) + 1
    INTO next_sequence
    FROM messages
    WHERE conversation_id = p_conversation_id;

    IF (p_role = 'user' AND next_sequence >= 400)
       OR (p_role = 'assistant' AND next_sequence > 400) THEN
        RETURN jsonb_build_object('status', 'full');
    END IF;

    INSERT INTO messages (conversation_id, sequence_no, role, content)
    VALUES (p_conversation_id, next_sequence, p_role, trim(p_content))
    RETURNING jsonb_build_object(
        'id', id::text,
        'role', role,
        'content', content,
        'sequence_no', sequence_no,
        'created_at', created_at
    )
    INTO saved_message;

    UPDATE conversations
    SET title = '私密对话',
        updated_at = now(),
        ended_at = CASE WHEN p_role = 'user' THEN NULL ELSE ended_at END
    WHERE id = p_conversation_id;

    RETURN jsonb_build_object('status', 'ok', 'message', saved_message);
END;
$$;

CREATE OR REPLACE FUNCTION lucia_remove_message(p_message_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    DELETE FROM messages WHERE id = p_message_id;
    RETURN FOUND;
END;
$$;

DROP FUNCTION IF EXISTS lucia_search_memories(text, integer, real);
CREATE OR REPLACE FUNCTION lucia_search_memories(
    p_embedding text,
    p_scope_tag text,
    p_limit integer DEFAULT 5,
    p_min_similarity real DEFAULT 0.45
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    result jsonb;
BEGIN
    WITH ranked AS MATERIALIZED (
        SELECT
            id,
            content,
            1 - (embedding <=> p_embedding::vector) AS similarity
        FROM memories
        WHERE content LIKE 'enc:v1:%'
          AND scope_tag = p_scope_tag
        ORDER BY embedding <=> p_embedding::vector
        LIMIT least(greatest(p_limit, 1), 10)
    ),
    touched AS (
        UPDATE memories
        SET last_recalled_at = now()
        WHERE id IN (
            SELECT id FROM ranked WHERE similarity >= p_min_similarity
        )
        RETURNING id
    )
    SELECT coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', ranked.id::text,
                'content', ranked.content,
                'similarity', ranked.similarity
            )
            ORDER BY ranked.similarity DESC
        ),
        '[]'::jsonb
    )
    INTO result
    FROM ranked
    WHERE ranked.similarity >= p_min_similarity;

    RETURN result;
END;
$$;

DROP FUNCTION IF EXISTS lucia_save_memories(bigint, jsonb);
CREATE OR REPLACE FUNCTION lucia_save_memories(
    p_source_message_id bigint,
    p_scope_tag text,
    p_memories jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    saved_count integer;
    total_count integer;
BEGIN
    INSERT INTO memories (source_message_id, content, fingerprint, scope_tag, embedding)
    SELECT
        p_source_message_id,
        item->>'content',
        item->>'fingerprint',
        p_scope_tag,
        (item->>'embedding')::vector
    FROM jsonb_array_elements(p_memories) AS item
    WHERE item->>'content' LIKE 'enc:v1:%'
      AND length(coalesce(item->>'fingerprint', '')) > 0
      AND length(coalesce(p_scope_tag, '')) BETWEEN 20 AND 100
      AND item ? 'embedding'
    ON CONFLICT (scope_tag, fingerprint) DO UPDATE
    SET source_message_id = excluded.source_message_id,
        content = excluded.content,
        scope_tag = excluded.scope_tag,
        embedding = excluded.embedding,
        created_at = now();

    GET DIAGNOSTICS saved_count = ROW_COUNT;

    DELETE FROM memories
    WHERE id IN (
        SELECT id
        FROM memories
        ORDER BY created_at DESC, id DESC
        OFFSET 1000
    );

    SELECT count(*)::integer INTO total_count FROM memories;
    RETURN jsonb_build_object('saved', saved_count, 'total', total_count);
END;
$$;
